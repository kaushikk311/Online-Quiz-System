// tests for auto and manual submission (#9)
// "allow students to manually submit their quiz before the time expires or the test
//  automatically submits after the timer runs out"
// the API tests use the real database from .env (same as concurrency.test.js).
// if the database is not running those tests are skipped.

require('dotenv').config({ quiet: true });
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/db');
const { autoSubmitExpiredAttempts } = require('../src/jobs/autoSubmit');
const { getSubmitType } = require('../src/utils/attemptHelper');

const QUIZ_TITLE = 'Submission Test Quiz (auto created)';
const EMAIL_LIKE = 'subtest\\_%@test.com';

// total marks = 4, time limit is 10 minutes
const QUESTIONS = [
  { type: 'MCQ', text: 'Which data structure works in FIFO order?', options: ['Stack', 'Queue', 'Tree', 'Graph'], answer: 'Queue', wrong: 'Stack', marks: 1 },
  { type: 'TRUE_FALSE', text: 'HTTP is a stateless protocol.', options: null, answer: 'True', wrong: 'False', marks: 1 },
  { type: 'FILL_BLANK', text: 'The SQL command to add new rows is ______.', options: null, answer: 'INSERT', wrong: 'wrong', marks: 2 }
];

let dbReady = false;
let quizId;
let questionIds = [];
let student1;
let student2;
let firstAttemptId; // the attempt submitted in the first test, used again in later tests

function tokenFor(studentId) {
  return 'Bearer ' + jwt.sign({ id: studentId, name: 'Submit Test', role: 'STUDENT' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function allAnswers(correct) {
  return QUESTIONS.map((q, i) => ({ questionId: questionIds[i], answer: correct ? q.answer : q.wrong }));
}

// makes an attempt straight in the database that started some minutes ago,
// so the time limit can be over without waiting for it
async function attemptStartedAgo(studentId, seconds) {
  const res = await pool.query(
    `INSERT INTO attempts (quiz_id, student_id, started_at)
     VALUES ($1, $2, NOW() - $3 * INTERVAL '1 second') RETURNING id`,
    [quizId, studentId, seconds]
  );
  return res.rows[0].id;
}

function submit(attemptId, studentId, body) {
  return request(app)
    .post('/api/attempts/' + attemptId + '/submit')
    .set('Authorization', tokenFor(studentId))
    .send(body);
}

// attempts are deleted first because attempts.student_id has no ON DELETE CASCADE
async function removeTestData() {
  await pool.query(
    'DELETE FROM attempts WHERE student_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [EMAIL_LIKE]
  );
  await pool.query('DELETE FROM quizzes WHERE title = $1', [QUIZ_TITLE]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [EMAIL_LIKE]);
}

beforeAll(async () => {
  try {
    await pool.query('SELECT 1');
    dbReady = true;
  } catch (err) {
    console.log('Database is not running, so the submission tests are skipped');
    return;
  }

  await removeTestData();

  const quizRes = await pool.query(
    `INSERT INTO quizzes (title, subject, time_limit_minutes, pass_percentage, start_time, end_time, max_attempts)
     VALUES ($1, 'Testing', 10, 50, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 10)
     RETURNING id`,
    [QUIZ_TITLE]
  );
  quizId = quizRes.rows[0].id;

  for (const q of QUESTIONS) {
    const r = await pool.query(
      `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer, marks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [quizId, q.text, q.type, q.options ? JSON.stringify(q.options) : null, q.answer, q.marks]
    );
    questionIds.push(r.rows[0].id);
  }

  // password is not used because the tests make the token directly
  const usersRes = await pool.query(
    `INSERT INTO users (name, email, password, role) VALUES
     ('Submit Test 1', 'subtest_1@test.com', 'not_used', 'STUDENT'),
     ('Submit Test 2', 'subtest_2@test.com', 'not_used', 'STUDENT')
     RETURNING id`
  );
  student1 = usersRes.rows[0].id;
  student2 = usersRes.rows[1].id;
});

afterAll(async () => {
  if (dbReady) {
    await removeTestData();
  }
  await pool.end();
});

describe('getSubmitType', () => {
  function deadlineIn(seconds) {
    return new Date(Date.now() + seconds * 1000);
  }

  test('student clicking submit with time left is MANUAL', () => {
    expect(getSubmitType(false, deadlineIn(300))).toBe('MANUAL');
  });

  test('auto sent while a lot of time is left is still MANUAL', () => {
    expect(getSubmitType(true, deadlineIn(300))).toBe('MANUAL');
  });

  test('auto sent in the last few seconds is AUTO (browser timer can be a bit early)', () => {
    expect(getSubmitType(true, deadlineIn(2))).toBe('AUTO');
  });

  test('anything after the deadline is AUTO', () => {
    expect(getSubmitType(false, deadlineIn(-1))).toBe('AUTO');
    expect(getSubmitType(true, deadlineIn(-1))).toBe('AUTO');
  });
});

describe('Submitting a quiz (#9)', () => {
  test('student can submit before the time is over', async () => {
    if (!dbReady) return;

    const start = await request(app)
      .post('/api/attempts/start/' + quizId)
      .set('Authorization', tokenFor(student1));
    expect(start.statusCode).toBe(201);
    firstAttemptId = start.body.attemptId;

    const res = await submit(firstAttemptId, student1, { answers: allAnswers(true), auto: false });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Quiz submitted');
    expect(res.body.lateAnswersIgnored).toBe(false);
    expect(res.body.result.submitType).toBe('MANUAL');
    expect(res.body.result.score).toBe(4);
    expect(res.body.result.result).toBe('PASS');

    const check = await pool.query('SELECT status FROM attempts WHERE id = $1', [firstAttemptId]);
    expect(check.rows[0].status).toBe('SUBMITTED');
  });

  test('submitting again gives the old result and is not evaluated again', async () => {
    if (!dbReady) return;
    const before = await pool.query('SELECT submitted_at FROM attempts WHERE id = $1', [firstAttemptId]);

    const res = await submit(firstAttemptId, student1, { answers: allAnswers(false), auto: false });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Quiz was already submitted');
    expect(res.body.result.score).toBe(4);
    expect(new Date(res.body.result.submittedAt).getTime()).toBe(before.rows[0].submitted_at.getTime());
  });

  test('answers cannot be changed after submitting', async () => {
    if (!dbReady) return;

    const res = await request(app)
      .put('/api/attempts/' + firstAttemptId + '/answers')
      .set('Authorization', tokenFor(student1))
      .send({ answers: allAnswers(false) });
    expect(res.statusCode).toBe(409);
  });

  test('student cannot submit someone else\'s attempt', async () => {
    if (!dbReady) return;

    const res = await submit(firstAttemptId, student2, { answers: allAnswers(true) });
    expect(res.statusCode).toBe(403);
  });

  test('auto sent early is saved as MANUAL', async () => {
    if (!dbReady) return;
    const attemptId = await attemptStartedAgo(student1, 60);

    const res = await submit(attemptId, student1, { answers: allAnswers(true), auto: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.result.submitType).toBe('MANUAL');
  });

  test('submit when the timer runs out is saved as AUTO and the answers are counted', async () => {
    if (!dbReady) return;
    // 10 min limit, started 10 min 5 sec ago -> time just ran out, still inside the grace time
    const attemptId = await attemptStartedAgo(student1, 605);

    const res = await submit(attemptId, student1, { answers: allAnswers(true), auto: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.result.submitType).toBe('AUTO');
    expect(res.body.result.score).toBe(4);
    expect(res.body.lateAnswersIgnored).toBe(false);
  });

  test('answers that reach the server after time + grace are not counted', async () => {
    if (!dbReady) return;
    // started 12 min ago -> 2 min past the time limit
    const attemptId = await attemptStartedAgo(student1, 720);
    // only the first question was autosaved while the time was still running
    await pool.query(
      'INSERT INTO attempt_answers (attempt_id, question_id, given_answer) VALUES ($1, $2, $3)',
      [attemptId, questionIds[0], QUESTIONS[0].answer]
    );

    const res = await submit(attemptId, student1, { answers: allAnswers(true), auto: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.lateAnswersIgnored).toBe(true);
    expect(res.body.message).toMatch(/Time was over/);
    expect(res.body.result.submitType).toBe('AUTO');
    expect(res.body.result.score).toBe(1);
  });

  test('auto has to be true or false', async () => {
    if (!dbReady) return;
    const res = await submit(firstAttemptId, student1, { answers: [], auto: 'yes' });
    expect(res.statusCode).toBe(400);
  });

  test('answers have to be a list', async () => {
    if (!dbReady) return;
    const res = await submit(firstAttemptId, student1, { answers: 'Queue' });
    expect(res.statusCode).toBe(400);
  });

  test('server submits attempts left open after the time is over, and leaves running ones', async () => {
    if (!dbReady) return;
    // student 2 closed the browser 15 min ago after autosaving one right answer
    const expiredId = await attemptStartedAgo(student2, 900);
    await pool.query(
      'INSERT INTO attempt_answers (attempt_id, question_id, given_answer) VALUES ($1, $2, $3)',
      [expiredId, questionIds[1], QUESTIONS[1].answer]
    );
    // student 1 is still doing the quiz
    const runningId = await attemptStartedAgo(student1, 60);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await autoSubmitExpiredAttempts();
    logSpy.mockRestore();

    const expired = await pool.query('SELECT status, submit_type, score FROM attempts WHERE id = $1', [expiredId]);
    expect(expired.rows[0].status).toBe('SUBMITTED');
    expect(expired.rows[0].submit_type).toBe('AUTO');
    expect(expired.rows[0].score).toBe(1);

    const running = await pool.query('SELECT status FROM attempts WHERE id = $1', [runningId]);
    expect(running.rows[0].status).toBe('IN_PROGRESS');
  });
});

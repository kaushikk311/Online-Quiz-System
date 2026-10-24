// makes a quiz and some student accounts straight in the database (#18)
// used by tests/concurrency.test.js and scripts/loadTest.js
// everything made here is deleted again by removeTestData()

const bcrypt = require('bcrypt');
const pool = require('../../src/db');

const QUIZ_TITLE = 'Load Test Quiz (auto created)';
const EMAIL_LIKE = 'loadtest\\_%@test.com';
const TEST_PASSWORD = 'test123';

// total marks = 4
const QUESTIONS = [
  { type: 'MCQ', text: 'Which data structure works in FIFO order?', options: ['Stack', 'Queue', 'Tree', 'Graph'], answer: 'Queue', marks: 1 },
  { type: 'TRUE_FALSE', text: 'HTTP is a stateless protocol.', options: null, answer: 'True', marks: 1 },
  { type: 'FILL_BLANK', text: 'The SQL command to add new rows is ______.', options: null, answer: 'INSERT', marks: 2 }
];

// attempts are deleted first because attempts.student_id has no ON DELETE CASCADE
async function removeTestData() {
  await pool.query(
    'DELETE FROM attempts WHERE student_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [EMAIL_LIKE]
  );
  await pool.query('DELETE FROM quizzes WHERE title = $1', [QUIZ_TITLE]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [EMAIL_LIKE]);
}

// quiz is open from 1 hour ago to 1 hour from now, 10 min time limit
async function createTestData(studentCount) {
  // clear anything left from an old run that stopped in the middle
  await removeTestData();

  const quizRes = await pool.query(
    `INSERT INTO quizzes (title, subject, time_limit_minutes, pass_percentage, start_time, end_time, max_attempts)
     VALUES ($1, 'Testing', 10, 50, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 1)
     RETURNING id`,
    [QUIZ_TITLE]
  );
  const quizId = quizRes.rows[0].id;

  const questionIds = [];
  for (const q of QUESTIONS) {
    const r = await pool.query(
      `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer, marks)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [quizId, q.text, q.type, q.options ? JSON.stringify(q.options) : null, q.answer, q.marks]
    );
    questionIds.push(r.rows[0].id);
  }

  // all test students have the same password, so it is hashed only once
  const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
  const usersRes = await pool.query(
    `INSERT INTO users (name, email, password, role)
     SELECT 'Load Test Student ' || n, 'loadtest_' || n || '@test.com', $2, 'STUDENT'
     FROM generate_series(1, $1) AS n
     RETURNING id, email`,
    [studentCount, hashed]
  );
  const students = usersRes.rows.sort((a, b) => a.id - b.id);

  return { quizId, questionIds, students };
}

function wrongAnswer(q) {
  if (q.type === 'MCQ') {
    return q.options.find((opt) => opt !== q.answer);
  }
  if (q.type === 'TRUE_FALSE') {
    return q.answer === 'True' ? 'False' : 'True';
  }
  return 'wrong';
}

// all right answers (score 4) or all wrong answers (score 0)
function makeAnswers(questionIds, allCorrect) {
  return QUESTIONS.map((q, i) => ({
    questionId: questionIds[i],
    answer: allCorrect ? q.answer : wrongAnswer(q)
  }));
}

module.exports = { TEST_PASSWORD, createTestData, removeTestData, makeAnswers };

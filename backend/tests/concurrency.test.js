// tests for performance and concurrency (#18)
// "the system must support multiple concurrent Student sessions without significant
//  performance degradation"
// these tests use the real database from .env, because the point is to see what
// postgres does when many students do the same thing at the same time.
// if the database is not running these tests are skipped.

require('dotenv').config({ quiet: true });
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/db');
const { autoSubmitExpiredAttempts } = require('../src/jobs/autoSubmit');
const { createTestData, removeTestData, makeAnswers } = require('./helpers/testData');

const STUDENTS = 50;

let dbReady = false;
let server;
let data;
let students = []; // everyone except the first student, who is used for the double click tests
const attemptOf = {}; // student id -> attempt id

jest.setTimeout(30000);

function tokenFor(studentId) {
  return 'Bearer ' + jwt.sign({ id: studentId, name: 'Load Test', role: 'STUDENT' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// sends the request and also notes how long it took
async function timed(req) {
  const start = Date.now();
  const res = await req;
  return { res, ms: Date.now() - start };
}

beforeAll(async () => {
  try {
    await pool.query('SELECT 1');
    dbReady = true;
  } catch (err) {
    console.log('Database is not running, so the concurrency tests are skipped');
    return;
  }

  data = await createTestData(STUDENTS);
  students = data.students.slice(1).map((s) => s.id);
  server = app.listen(0);
});

afterAll(async () => {
  if (server) {
    server.close();
  }
  if (dbReady) {
    await removeTestData();
  }
  await pool.end();
});

describe('Many students at the same time (#18)', () => {
  test('clicking start 5 times together makes only one attempt', async () => {
    if (!dbReady) return;
    const studentId = data.students[0].id;

    const calls = [];
    for (let i = 0; i < 5; i++) {
      calls.push(request(server).post('/api/attempts/start/' + data.quizId).set('Authorization', tokenFor(studentId)));
    }
    const responses = await Promise.all(calls);

    const ids = new Set();
    responses.forEach((res) => {
      expect([200, 201]).toContain(res.statusCode);
      ids.add(res.body.attemptId);
    });
    expect(ids.size).toBe(1);

    const count = await pool.query(
      'SELECT COUNT(*) FROM attempts WHERE quiz_id = $1 AND student_id = $2',
      [data.quizId, studentId]
    );
    expect(Number(count.rows[0].count)).toBe(1);
    attemptOf[studentId] = [...ids][0];
  });

  test('all students can start the same quiz together', async () => {
    if (!dbReady) return;

    const results = await Promise.all(students.map((id) =>
      timed(request(server).post('/api/attempts/start/' + data.quizId).set('Authorization', tokenFor(id)))
    ));

    results.forEach(({ res }, i) => {
      expect(res.statusCode).toBe(201);
      attemptOf[students[i]] = res.body.attemptId;
    });

    // every student got their own attempt
    const ids = new Set(students.map((id) => attemptOf[id]));
    expect(ids.size).toBe(students.length);

    const slowest = Math.max(...results.map((r) => r.ms));
    expect(slowest).toBeLessThan(5000);
  });

  test('all students can load their questions together', async () => {
    if (!dbReady) return;

    const results = await Promise.all(students.map((id) =>
      timed(request(server).get('/api/attempts/' + attemptOf[id]).set('Authorization', tokenFor(id)))
    ));

    results.forEach(({ res }) => {
      expect(res.statusCode).toBe(200);
      expect(res.body.questions.length).toBe(3);
      expect(res.body.timeLeftSeconds).toBeGreaterThan(0);
      // answers must not be sent to the student
      expect(res.body.questions[0].correct_answer).toBeUndefined();
    });

    const slowest = Math.max(...results.map((r) => r.ms));
    expect(slowest).toBeLessThan(5000);
  });

  test('autosave from all students together saves every answer', async () => {
    if (!dbReady) return;

    const results = await Promise.all(students.map((id, i) =>
      timed(request(server)
        .put('/api/attempts/' + attemptOf[id] + '/answers')
        .set('Authorization', tokenFor(id))
        .send({ answers: makeAnswers(data.questionIds, i % 2 === 0) }))
    ));

    results.forEach(({ res }) => {
      expect(res.statusCode).toBe(200);
    });

    const saved = await pool.query(
      'SELECT COUNT(*) FROM attempt_answers WHERE attempt_id = ANY($1::int[])',
      [students.map((id) => attemptOf[id])]
    );
    expect(Number(saved.rows[0].count)).toBe(students.length * 3);
  });

  test('all students submit together and each one gets the right score', async () => {
    if (!dbReady) return;

    const results = await Promise.all(students.map((id, i) =>
      timed(request(server)
        .post('/api/attempts/' + attemptOf[id] + '/submit')
        .set('Authorization', tokenFor(id))
        .send({ answers: makeAnswers(data.questionIds, i % 2 === 0) }))
    ));

    results.forEach(({ res }, i) => {
      expect(res.statusCode).toBe(200);
      expect(res.body.result.attemptId).toBe(attemptOf[students[i]]);
      if (i % 2 === 0) {
        expect(res.body.result.score).toBe(4);
        expect(res.body.result.result).toBe('PASS');
      } else {
        expect(res.body.result.score).toBe(0);
        expect(res.body.result.result).toBe('FAIL');
      }
    });

    const slowest = Math.max(...results.map((r) => r.ms));
    expect(slowest).toBeLessThan(5000);
  });

  test('same attempt submitted 5 times together (with an autosave) is evaluated only once', async () => {
    if (!dbReady) return;
    const studentId = data.students[0].id;
    const attemptId = attemptOf[studentId];
    const answers = makeAnswers(data.questionIds, true);

    const calls = [
      request(server).put('/api/attempts/' + attemptId + '/answers').set('Authorization', tokenFor(studentId)).send({ answers })
    ];
    for (let i = 0; i < 5; i++) {
      calls.push(request(server).post('/api/attempts/' + attemptId + '/submit').set('Authorization', tokenFor(studentId)).send({ answers }));
    }
    const [autosave, ...submits] = await Promise.all(calls);

    // autosave is either saved before the submit or told that it is already submitted
    expect([200, 409]).toContain(autosave.statusCode);

    submits.forEach((res) => {
      expect(res.statusCode).toBe(200);
      expect(res.body.result.score).toBe(4);
      expect(res.body.result.submittedAt).toBe(submits[0].body.result.submittedAt);
    });
    const firstTime = submits.filter((res) => res.body.message === 'Quiz submitted');
    expect(firstTime.length).toBe(1);
  });

  test('100 quiz list requests together are all answered quickly', async () => {
    if (!dbReady) return;

    const calls = [];
    for (let i = 0; i < 100; i++) {
      const id = students[i % students.length];
      calls.push(timed(request(server).get('/api/quizzes').set('Authorization', tokenFor(id))));
    }
    const results = await Promise.all(calls);

    results.forEach(({ res }) => {
      expect(res.statusCode).toBe(200);
    });
    const slowest = Math.max(...results.map((r) => r.ms));
    expect(slowest).toBeLessThan(5000);
  });

  test('auto submit job handles a whole class running out of time together', async () => {
    if (!dbReady) return;

    // new attempts for everyone that started 20 min ago, so the 10 min limit is over
    const inserted = await pool.query(
      `INSERT INTO attempts (quiz_id, student_id, started_at)
       SELECT $1, s, NOW() - INTERVAL '20 minutes' FROM unnest($2::int[]) AS s
       RETURNING id`,
      [data.quizId, students]
    );
    const ids = inserted.rows.map((r) => r.id);

    // two rounds at the same time, the second one should just skip
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await Promise.all([autoSubmitExpiredAttempts(), autoSubmitExpiredAttempts()]);
    logSpy.mockRestore();

    const check = await pool.query(
      'SELECT status, submit_type, score FROM attempts WHERE id = ANY($1::int[])',
      [ids]
    );
    expect(check.rows.length).toBe(students.length);
    check.rows.forEach((row) => {
      expect(row.status).toBe('SUBMITTED');
      expect(row.submit_type).toBe('AUTO');
      expect(row.score).toBe(0);
    });
  });

  test('connection pool is free again after all this', async () => {
    if (!dbReady) return;

    const res = await request(server).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dbConnections.waiting).toBe(0);
  });
});

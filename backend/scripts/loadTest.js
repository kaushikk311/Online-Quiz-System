// load test for #18 (performance and concurrency)
// makes N test students and one quiz, then all the students do the whole quiz at the same time:
// login -> start quiz -> load questions -> autosave -> submit -> see result
// at the end it prints how long each step took. the test data is deleted after.
//
// run:  npm run loadtest            (50 students)
//       npm run loadtest -- 200     (200 students)

require('dotenv').config({ quiet: true });
const app = require('../src/app');
const pool = require('../src/db');
const { TEST_PASSWORD, createTestData, removeTestData, makeAnswers } = require('../tests/helpers/testData');

const STUDENTS = Number(process.argv[2]) || 50;

const timings = {}; // step name -> list of times in ms
const errors = [];

async function call(baseUrl, step, path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const start = Date.now();
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  const ms = Date.now() - start;

  if (!timings[step]) {
    timings[step] = [];
  }
  timings[step].push(ms);

  if (!res.ok) {
    throw new Error(step + ' failed with ' + res.status + ': ' + data.message);
  }
  return data;
}

// what one student does. half of them answer everything right, the other half everything wrong
async function studentFlow(baseUrl, student, index, testData) {
  const allCorrect = index % 2 === 0;
  const answers = makeAnswers(testData.questionIds, allCorrect);

  const login = await call(baseUrl, 'login', '/api/auth/login', 'POST', { email: student.email, password: TEST_PASSWORD });
  const token = login.token;

  const started = await call(baseUrl, 'start quiz', '/api/attempts/start/' + testData.quizId, 'POST', null, token);
  const attemptPath = '/api/attempts/' + started.attemptId;

  await call(baseUrl, 'load questions', attemptPath, 'GET', null, token);

  // two autosaves, like a student who answers one question and then the rest
  await call(baseUrl, 'autosave', attemptPath + '/answers', 'PUT', { answers: answers.slice(0, 1) }, token);
  await call(baseUrl, 'autosave', attemptPath + '/answers', 'PUT', { answers }, token);

  const submitted = await call(baseUrl, 'submit', attemptPath + '/submit', 'POST', { answers }, token);
  await call(baseUrl, 'result', attemptPath + '/result', 'GET', null, token);

  const expected = allCorrect ? 4 : 0;
  if (submitted.result.score !== expected) {
    throw new Error('Student ' + student.email + ' got score ' + submitted.result.score + ', expected ' + expected);
  }
}

function printReport(totalMs) {
  console.log('');
  console.log('Load test with ' + STUDENTS + ' students at the same time');
  console.log('');
  console.log('Step'.padEnd(16) + 'Requests'.padStart(10) + 'Avg ms'.padStart(10) + 'Max ms'.padStart(10));
  console.log('-'.repeat(46));
  for (const step of Object.keys(timings)) {
    const list = timings[step];
    const avg = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    const max = Math.max(...list);
    console.log(step.padEnd(16) + String(list.length).padStart(10) + String(avg).padStart(10) + String(max).padStart(10));
  }
  console.log('-'.repeat(46));
  console.log('Total time: ' + (totalMs / 1000).toFixed(2) + ' sec');
  console.log('Students finished without any problem: ' + (STUDENTS - errors.length) + ' / ' + STUDENTS);
  if (errors.length > 0) {
    console.log('Errors:');
    errors.slice(0, 10).forEach((e) => console.log('  ' + e));
  }
}

async function main() {
  console.log('Creating ' + STUDENTS + ' test students and a test quiz...');
  const testData = await createTestData(STUDENTS);

  // the app is started on any free port just for this test
  const server = app.listen(0);
  const baseUrl = 'http://127.0.0.1:' + server.address().port;

  console.log('Running...');
  const start = Date.now();
  await Promise.all(testData.students.map((student, i) =>
    studentFlow(baseUrl, student, i, testData).catch((err) => errors.push(err.message))
  ));
  const totalMs = Date.now() - start;

  printReport(totalMs);

  server.closeAllConnections();
  server.close();
  await removeTestData();
  console.log('Test data deleted');
  await pool.end();

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch(async (err) => {
  console.log('Load test failed:', err.message);
  try {
    await removeTestData();
  } catch (e) {
    // database itself is not reachable
  }
  await pool.end();
  process.exit(1);
});

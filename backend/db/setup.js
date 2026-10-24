// creates the tables and adds some demo data for testing
// make sure the database (DB_NAME in .env) is already created in pgAdmin / psql

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../src/db');

const demoUsers = [
  { name: 'Admin User', email: 'admin@quiz.com', password: 'admin123', role: 'ADMIN' },
  { name: 'Teacher One', email: 'teacher@quiz.com', password: 'teacher123', role: 'TEACHER' },
  { name: 'Student One', email: 'student@quiz.com', password: 'student123', role: 'STUDENT' },
  { name: 'Student Two', email: 'student2@quiz.com', password: 'student123', role: 'STUDENT' }
];

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function addQuiz(teacherId, quiz, questions) {
  const res = await pool.query(
    `INSERT INTO quizzes (title, subject, time_limit_minutes, pass_percentage, start_time, end_time, max_attempts, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [quiz.title, quiz.subject, quiz.timeLimit, quiz.passPercentage, quiz.start, quiz.end, quiz.maxAttempts, teacherId]
  );
  const quizId = res.rows[0].id;

  for (const q of questions) {
    await pool.query(
      `INSERT INTO questions (quiz_id, question_text, question_type, options, correct_answer, explanation, marks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [quizId, q.text, q.type, q.options ? JSON.stringify(q.options) : null, q.answer, q.explanation || null, q.marks || 1]
    );
  }
  console.log('Added quiz: ' + quiz.title);
}

async function setup() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Tables created');

  for (const u of demoUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
      [u.name, u.email, hashed, u.role]
    );
  }
  console.log('Demo users added');

  // only add sample quizzes the first time
  const count = await pool.query('SELECT COUNT(*) FROM quizzes');
  if (Number(count.rows[0].count) > 0) {
    console.log('Quizzes already there, skipping sample quizzes');
    return;
  }

  const teacher = await pool.query("SELECT id FROM users WHERE email = 'teacher@quiz.com'");
  const teacherId = teacher.rows[0].id;

  await addQuiz(teacherId,
    { title: 'DBMS Basics', subject: 'DBMS', timeLimit: 10, passPercentage: 50, start: daysFromNow(-1), end: daysFromNow(30), maxAttempts: 2 },
    [
      { type: 'MCQ', text: 'Which SQL command removes all rows from a table but keeps the table structure?', options: ['DELETE', 'DROP', 'TRUNCATE', 'REMOVE'], answer: 'TRUNCATE', explanation: 'TRUNCATE removes all rows, DROP removes the table itself.' },
      { type: 'MCQ', text: 'Which normal form removes partial dependency?', options: ['1NF', '2NF', '3NF', 'BCNF'], answer: '2NF', explanation: '2NF removes partial dependency on a composite key.' },
      { type: 'TRUE_FALSE', text: 'A primary key column can contain NULL values.', answer: 'False', explanation: 'Primary key must be unique and NOT NULL.' },
      { type: 'TRUE_FALSE', text: 'A foreign key can refer to the primary key of another table.', answer: 'True' },
      { type: 'FILL_BLANK', text: 'The SQL clause used to sort the result is ORDER ____.', answer: 'BY', marks: 2 }
    ]
  );

  // short quiz (1 min) to test auto submit
  await addQuiz(teacherId,
    { title: 'Operating Systems Quick Test', subject: 'OS', timeLimit: 1, passPercentage: 60, start: daysFromNow(-1), end: daysFromNow(30), maxAttempts: 3 },
    [
      { type: 'MCQ', text: 'Which scheduling algorithm can cause starvation?', options: ['FCFS', 'Round Robin', 'Priority Scheduling', 'FIFO'], answer: 'Priority Scheduling' },
      { type: 'TRUE_FALSE', text: 'Deadlock can happen only if all four Coffman conditions hold.', answer: 'True' },
      { type: 'FILL_BLANK', text: 'A program in execution is called a ______.', answer: 'process' }
    ]
  );

  // upcoming quiz, students should not be able to start this one
  await addQuiz(teacherId,
    { title: 'Computer Networks Quiz', subject: 'CN', timeLimit: 15, passPercentage: 40, start: daysFromNow(2), end: daysFromNow(5), maxAttempts: 1 },
    [
      { type: 'MCQ', text: 'Which layer of the OSI model does routing?', options: ['Data Link', 'Network', 'Transport', 'Session'], answer: 'Network' },
      { type: 'TRUE_FALSE', text: 'TCP is a connectionless protocol.', answer: 'False' }
    ]
  );
}

setup()
  .then(() => {
    console.log('Setup done');
    return pool.end();
  })
  .catch((err) => {
    console.log('Setup failed:', err.message);
    pool.end();
    process.exit(1);
  });

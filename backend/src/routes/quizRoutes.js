const express = require('express');
const pool = require('../db');
const ROLES = require('../config/roles');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// list of quizzes - any logged in user can see this
// status is UPCOMING / OPEN / CLOSED and attempts_used is for the logged in student
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.id, q.title, q.subject, q.time_limit_minutes, q.pass_percentage,
              q.start_time, q.end_time, q.max_attempts,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
              (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND student_id = $1) AS attempts_used
       FROM quizzes q
       ORDER BY q.start_time`,
      [req.user.id]
    );

    const now = Date.now();
    const quizzes = result.rows.map((q) => {
      let status = 'OPEN';
      if (now < new Date(q.start_time).getTime()) {
        status = 'UPCOMING';
      } else if (now > new Date(q.end_time).getTime()) {
        status = 'CLOSED';
      }
      return {
        ...q,
        pass_percentage: Number(q.pass_percentage),
        question_count: Number(q.question_count),
        attempts_used: Number(q.attempts_used),
        status
      };
    });

    res.json(quizzes);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- TEACHER only ----------
// role check is done here, the actual logic will be added in
// #4 (create quiz), #5 (update/delete), #6 (schedule) and FR2 (questions)

router.post('/', authorize(ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Create quiz - to be done in #4' });
});

router.put('/:id', authorize(ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Update quiz - to be done in #5' });
});

router.delete('/:id', authorize(ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Delete quiz - to be done in #5' });
});

router.put('/:id/schedule', authorize(ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Schedule quiz - to be done in #6' });
});

router.post('/:id/questions', authorize(ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Add question - to be done (FR2)' });
});

// ---------- STUDENT only ----------

router.post('/:id/feedback', authorize(ROLES.STUDENT), (req, res) => {
  res.json({ message: 'Quiz feedback - to be done in #16' });
});

module.exports = router;

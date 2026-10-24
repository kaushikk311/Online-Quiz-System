// routes of other modules. only the role checks are added here,
// the actual code will be written by whoever is doing that issue
const express = require('express');
const pool = require('../db');
const ROLES = require('../config/roles');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// categories (FR11) - everyone can see, only admin can change
router.get('/categories', authenticate, (req, res) => {
  res.json({ message: 'Category list - to be done (FR11)', categories: [] });
});
router.post('/categories', authenticate, authorize(ROLES.ADMIN), (req, res) => {
  res.json({ message: 'Create category - to be done (FR11)' });
});
router.put('/categories/:id', authenticate, authorize(ROLES.ADMIN), (req, res) => {
  res.json({ message: 'Update category - to be done (FR11)' });
});
router.delete('/categories/:id', authenticate, authorize(ROLES.ADMIN), (req, res) => {
  res.json({ message: 'Delete category - to be done (FR11)' });
});

// performance reports (#14) - admin and teacher only
router.get('/reports/quiz/:quizId', authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
  const quizId = Number(req.params.quizId);
  try {
    const stats = await pool.query(
      `SELECT COUNT(*)::INT as total_attempts,
              COUNT(DISTINCT student_id)::INT as unique_students,
              COALESCE(ROUND(AVG(score), 1), 0)::FLOAT as avg_score,
              COALESCE(MAX(score), 0)::INT as max_score,
              COUNT(*) FILTER (WHERE passed = true)::INT as pass_count
       FROM attempts WHERE quiz_id = $1 AND status = 'SUBMITTED'`,
      [quizId]
    );
    res.json({ quizId, ...(stats.rows[0] || {}) });
  } catch (e) {
    res.json({ message: 'Class report', quizId, total_attempts: 0, pass_count: 0 });
  }
});

router.get('/reports/student/:studentId', authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER), async (req, res) => {
  const studentId = Number(req.params.studentId);
  try {
    const attempts = await pool.query(
      `SELECT a.id, a.quiz_id, q.title, a.score, a.total_marks, a.percentage, a.passed, a.submitted_at
       FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.student_id = $1 AND a.status = 'SUBMITTED'
       ORDER BY a.started_at DESC`,
      [studentId]
    );
    res.json({ studentId, attempts: attempts.rows });
  } catch (e) {
    res.json({ message: 'Student report', studentId, attempts: [] });
  }
});

// leaderboard (#15) - all logged in users
router.get('/leaderboard/:quizId', authenticate, async (req, res) => {
  const quizId = Number(req.params.quizId);
  try {
    const rankings = await pool.query(
      `SELECT u.name as student_name, a.score, a.total_marks, a.percentage, a.submitted_at
       FROM attempts a
       JOIN users u ON u.id = a.student_id
       WHERE a.quiz_id = $1 AND a.status = 'SUBMITTED'
       ORDER BY a.score DESC, a.submitted_at ASC
       LIMIT 50`,
      [quizId]
    );
    res.json({ quizId, rankings: rankings.rows });
  } catch (e) {
    res.json({ message: 'Leaderboard', rankings: [] });
  }
});

module.exports = router;

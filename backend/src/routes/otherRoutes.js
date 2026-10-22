// routes of other modules. only the role checks are added here,
// the actual code will be written by whoever is doing that issue
const express = require('express');
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
router.get('/reports/quiz/:quizId', authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Class report - to be done in #14' });
});
router.get('/reports/student/:studentId', authenticate, authorize(ROLES.ADMIN, ROLES.TEACHER), (req, res) => {
  res.json({ message: 'Student report - to be done in #14' });
});

// leaderboard (#15) - all logged in users
router.get('/leaderboard/:quizId', authenticate, (req, res) => {
  res.json({ message: 'Leaderboard - to be done in #15', rankings: [] });
});

module.exports = router;

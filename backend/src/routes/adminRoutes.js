const express = require('express');
const pool = require('../db');
const ROLES = require('../config/roles');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// every route in this file is admin only
router.use(authenticate, authorize(ROLES.ADMIN));

// list all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// change role of a user (for example make a student a teacher)
router.put('/users/:id/role', async (req, res) => {
  const { role } = req.body || {};
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }
  if (!Object.values(ROLES).includes(role)) {
    return res.status(400).json({ message: 'Role must be ADMIN, TEACHER or STUDENT' });
  }
  // so the admin does not remove their own admin access by mistake
  if (userId === req.user.id) {
    return res.status(400).json({ message: 'You cannot change your own role' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'Role updated', user: result.rows[0] });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

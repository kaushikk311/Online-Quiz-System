const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const ROLES = require('../config/roles');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// register - anyone who signs up is a STUDENT
// teacher / admin role can only be given by the admin (see adminRoutes.js)
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }
  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password should be at least 6 characters' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // never store plain password
    const hashed = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [String(name).trim(), cleanEmail, hashed, ROLES.STUDENT]
    );

    res.status(201).json({ message: 'Registered successfully', user: result.rows[0] });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// login - gives back a token which has the user id and role
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
    const user = result.rows[0];

    // same message for wrong email and wrong password so no one can guess emails
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// returns the logged in user (frontend uses this to check token)
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const quizRoutes = require('./routes/quizRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const otherRoutes = require('./routes/otherRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Online Quiz System API is running');
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api', otherRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// errors not handled inside the routes (like invalid JSON in body)
app.use((err, req, res, next) => {
  if (err.status === 400) {
    return res.status(400).json({ message: 'Invalid request data' });
  }
  console.log(err);
  res.status(500).json({ message: 'Something went wrong' });
});

module.exports = app;

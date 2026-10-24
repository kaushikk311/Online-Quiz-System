const express = require('express');
const cors = require('cors');
const pool = require('./db');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const quizRoutes = require('./routes/quizRoutes');
const attemptRoutes = require('./routes/attemptRoutes');
const otherRoutes = require('./routes/otherRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// prints requests that take more than 1 second, to find the slow parts
// when a lot of students are using the system together (#18)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const took = Date.now() - start;
    if (took > 1000) {
      console.log('Slow request: ' + req.method + ' ' + req.originalUrl + ' took ' + took + ' ms');
    }
  });
  next();
});

app.get('/', (req, res) => {
  res.send('Online Quiz System API is running');
});

// to check if the server and database are fine and how busy the connection pool is (#18)
// waiting = requests waiting for a free database connection
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      dbConnections: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }
    });
  } catch (err) {
    res.status(503).json({ status: 'down', message: 'Database is not reachable' });
  }
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

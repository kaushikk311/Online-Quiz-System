const { Pool } = require('pg');

// database details come from .env file
// pool settings are for many students using the quiz at the same time (#18)
// max = how many connections are kept open (postgres allows 100 by default)
// if all of them are busy the request waits, but only for connectionTimeoutMillis
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // lets scripts and tests finish without waiting for idle connections to close
  allowExitOnIdle: true
});

// without this the server crashes if an idle connection is dropped by postgres
pool.on('error', (err) => {
  console.log('Database connection error:', err.message);
});

module.exports = pool;

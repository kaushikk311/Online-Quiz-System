const pool = require('../db');
const { submitAttempt } = require('../utils/submitAttempt');
const { GRACE_SECONDS } = require('../utils/attemptHelper');

// if a student closes the browser or loses internet, the frontend timer cannot submit.
// so the server also checks every few seconds and submits attempts whose time is over (#9)
// we wait for the grace time first so the frontend auto submit (with final answers) can reach first
async function autoSubmitExpiredAttempts() {
  try {
    const res = await pool.query(
      `SELECT a.id
       FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.status = 'IN_PROGRESS'
         AND LEAST(a.started_at + q.time_limit_minutes * INTERVAL '1 minute', q.end_time)
             + $1 * INTERVAL '1 second' < NOW()`,
      [GRACE_SECONDS]
    );

    for (const row of res.rows) {
      await submitAttempt(row.id, null, 'AUTO');
      console.log('Auto submitted attempt ' + row.id);
    }
  } catch (err) {
    console.log('Auto submit job error:', err.message);
  }
}

function startAutoSubmitJob() {
  setInterval(autoSubmitExpiredAttempts, 15 * 1000);
}

module.exports = { autoSubmitExpiredAttempts, startAutoSubmitJob };

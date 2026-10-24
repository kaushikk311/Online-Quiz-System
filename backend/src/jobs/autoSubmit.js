const pool = require('../db');
const { submitAttempt } = require('../utils/submitAttempt');
const { GRACE_SECONDS } = require('../utils/attemptHelper');

// if a student closes the browser or loses internet, the frontend timer cannot submit.
// so the server also checks every few seconds and submits attempts whose time is over (#9)
// we wait for the grace time first so the frontend auto submit (with final answers) can reach first
let jobRunning = false;

async function autoSubmitExpiredAttempts() {
  // when a whole class runs out of time together this round can take longer than 15 sec.
  // then the next round is skipped, otherwise both rounds would work on the same attempts (#18)
  if (jobRunning) {
    return;
  }
  jobRunning = true;

  try {
    // at most 200 per round so one round does not keep the database busy for too long
    const res = await pool.query(
      `SELECT a.id
       FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.status = 'IN_PROGRESS'
         AND LEAST(a.started_at + q.time_limit_minutes * INTERVAL '1 minute', q.end_time)
             + $1 * INTERVAL '1 second' < NOW()
       ORDER BY a.id
       LIMIT 200`,
      [GRACE_SECONDS]
    );

    for (const row of res.rows) {
      // one attempt failing should not stop the others from being submitted
      try {
        await submitAttempt(row.id, null, 'AUTO');
        console.log('Auto submitted attempt ' + row.id);
      } catch (err) {
        console.log('Could not auto submit attempt ' + row.id + ':', err.message);
      }
    }
  } catch (err) {
    console.log('Auto submit job error:', err.message);
  } finally {
    jobRunning = false;
  }
}

function startAutoSubmitJob() {
  setInterval(autoSubmitExpiredAttempts, 15 * 1000);
}

module.exports = { autoSubmitExpiredAttempts, startAutoSubmitJob };

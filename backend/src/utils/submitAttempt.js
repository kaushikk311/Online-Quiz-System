const pool = require('../db');
const { evaluateAttempt } = require('./evaluate');
const { getDeadline, isPastGrace, validateAnswers } = require('./attemptHelper');

// saves or updates answers of an attempt (used by autosave and by submit)
async function saveAnswers(client, attemptId, answers) {
  for (const item of answers) {
    await client.query(
      `INSERT INTO attempt_answers (attempt_id, question_id, given_answer)
       VALUES ($1, $2, $3)
       ON CONFLICT (attempt_id, question_id)
       DO UPDATE SET given_answer = EXCLUDED.given_answer, saved_at = NOW()`,
      [attemptId, item.questionId, item.answer || null]
    );
  }
}

// submits an attempt and calculates the score (#9, #10)
// submitType is 'MANUAL' (student clicked submit) or 'AUTO' (time over)
// everything is done in one transaction so the result is never saved half way (#19)
async function submitAttempt(attemptId, finalAnswers, submitType) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // FOR UPDATE locks this attempt row. so if submit is clicked twice, or auto submit
    // and manual submit happen at same time, the second one waits and then sees SUBMITTED
    const attemptRes = await client.query(
      `SELECT a.*, q.time_limit_minutes, q.end_time, q.pass_percentage
       FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [attemptId]
    );
    const attempt = attemptRes.rows[0];

    if (!attempt) {
      await client.query('ROLLBACK');
      return null;
    }

    // already submitted (maybe student retried after network error) -> just give old result
    if (attempt.status === 'SUBMITTED') {
      await client.query('COMMIT');
      return { attempt, alreadySubmitted: true };
    }

    const questionsRes = await client.query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id',
      [attempt.quiz_id]
    );
    const questions = questionsRes.rows;

    const deadline = getDeadline(attempt.started_at, attempt.time_limit_minutes, attempt.end_time);

    // answers coming after time is over (+ grace) are ignored,
    // only the answers that were already autosaved will be counted
    if (finalAnswers && finalAnswers.length > 0 && !isPastGrace(deadline)) {
      const error = validateAnswers(finalAnswers, questions);
      if (error) {
        const err = new Error(error);
        err.statusCode = 400;
        throw err;
      }
      await saveAnswers(client, attempt.id, finalAnswers);
    }

    if (Date.now() > deadline.getTime()) {
      submitType = 'AUTO';
    }

    const savedRes = await client.query(
      'SELECT question_id, given_answer FROM attempt_answers WHERE attempt_id = $1',
      [attempt.id]
    );
    const answerMap = {};
    savedRes.rows.forEach((row) => {
      answerMap[row.question_id] = row.given_answer;
    });

    const result = evaluateAttempt(questions, answerMap, Number(attempt.pass_percentage));

    // store correct/wrong for every question (unanswered ones also get a row)
    for (const r of result.results) {
      await client.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, given_answer, is_correct)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (attempt_id, question_id)
         DO UPDATE SET is_correct = EXCLUDED.is_correct`,
        [attempt.id, r.questionId, r.isCorrect]
      );
    }

    const updated = await client.query(
      `UPDATE attempts
       SET status = 'SUBMITTED', submitted_at = NOW(), submit_type = $2,
           score = $3, total_marks = $4, percentage = $5, passed = $6
       WHERE id = $1
       RETURNING *`,
      [attempt.id, submitType, result.score, result.total, result.percentage, result.passed]
    );

    await client.query('COMMIT');
    return { attempt: updated.rows[0], alreadySubmitted: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { saveAnswers, submitAttempt };

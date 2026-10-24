const express = require('express');
const pool = require('../db');
const ROLES = require('../config/roles');
const { authenticate, authorize, onlyOwnData } = require('../middleware/auth');
const { getDeadline, isPastGrace, validateAnswers } = require('../utils/attemptHelper');
const { saveAnswers, submitAttempt } = require('../utils/submitAttempt');

const router = express.Router();

router.use(authenticate);

function toId(value) {
  const id = Number(value);
  if (Number.isInteger(id) && id > 0) {
    return id;
  }
  return null;
}

// gets the attempt along with some quiz details
async function findAttempt(attemptId) {
  const result = await pool.query(
    `SELECT a.*, q.title, q.time_limit_minutes, q.end_time, q.pass_percentage
     FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.id = $1`,
    [attemptId]
  );
  return result.rows[0];
}

// the attempt that is still running for this student and quiz (there can be only one)
async function findRunningAttempt(quizId, studentId) {
  const result = await pool.query(
    "SELECT * FROM attempts WHERE quiz_id = $1 AND student_id = $2 AND status = 'IN_PROGRESS'",
    [quizId, studentId]
  );
  return result.rows[0];
}

function formatResult(attempt) {
  return {
    attemptId: attempt.id,
    quizId: attempt.quiz_id,
    quizTitle: attempt.title,
    score: attempt.score,
    totalMarks: attempt.total_marks,
    percentage: Number(attempt.percentage),
    passPercentage: Number(attempt.pass_percentage),
    passed: attempt.passed,
    result: attempt.passed ? 'PASS' : 'FAIL',
    submitType: attempt.submit_type,
    submittedAt: attempt.submitted_at
  };
}

// start a quiz (or continue the attempt that is already running)
router.post('/start/:quizId', authorize(ROLES.STUDENT), async (req, res) => {
  const quizId = toId(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ message: 'Invalid quiz id' });
  }

  try {
    const quizRes = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    const quiz = quizRes.rows[0];
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const now = Date.now();
    if (now < new Date(quiz.start_time).getTime()) {
      return res.status(403).json({ message: 'This quiz has not started yet' });
    }
    if (now > new Date(quiz.end_time).getTime()) {
      return res.status(403).json({ message: 'This quiz is closed' });
    }

    // if an attempt is already running give that one back
    // (student refreshed the page or the internet went off and came back)
    const attempt = await findRunningAttempt(quizId, req.user.id);
    if (attempt) {
      const deadline = getDeadline(attempt.started_at, quiz.time_limit_minutes, quiz.end_time);
      if (Date.now() < deadline.getTime()) {
        return res.json({ attemptId: attempt.id, resumed: true });
      }
      // time for that attempt is already over so submit it first
      await submitAttempt(attempt.id, null, 'AUTO');
    }

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM attempts WHERE quiz_id = $1 AND student_id = $2',
      [quizId, req.user.id]
    );
    if (Number(countRes.rows[0].count) >= quiz.max_attempts) {
      // if start was clicked twice at the same time, the other request may have made
      // the attempt just now. give that one back instead of saying no attempts are left (#18)
      const justStarted = await findRunningAttempt(quizId, req.user.id);
      if (justStarted) {
        return res.json({ attemptId: justStarted.id, resumed: true });
      }
      return res.status(403).json({ message: 'You have used all your attempts for this quiz' });
    }

    const insert = await pool.query(
      'INSERT INTO attempts (quiz_id, student_id) VALUES ($1, $2) RETURNING id',
      [quizId, req.user.id]
    );
    res.status(201).json({ attemptId: insert.rows[0].id, resumed: false });
  } catch (err) {
    // 23505 = unique violation, happens when start is clicked twice at the same time
    if (err.code === '23505') {
      const again = await findRunningAttempt(quizId, req.user.id);
      if (again) {
        return res.json({ attemptId: again.id, resumed: true });
      }
    }
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// attempt history - student can see only their own, teacher/admin can see any student (#12)
router.get('/history/:studentId', onlyOwnData, async (req, res) => {
  const studentId = toId(req.params.studentId);
  if (!studentId) {
    return res.status(400).json({ message: 'Invalid student id' });
  }

  const { status, quizId } = req.query || {};

  try {
    let query = `
      SELECT a.id, a.quiz_id, q.title, q.subject, q.pass_percentage, q.time_limit_minutes,
             a.started_at, a.submitted_at, a.status, a.submit_type, a.score, a.total_marks,
             a.percentage, a.passed,
             CASE
               WHEN a.submitted_at IS NOT NULL THEN EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))::INT
               ELSE NULL
             END AS duration_seconds
      FROM attempts a
      JOIN quizzes q ON q.id = a.quiz_id
      WHERE a.student_id = $1
    `;
    const params = [studentId];

    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (quizId) {
      const qId = toId(quizId);
      if (qId) {
        params.push(qId);
        query += ` AND a.quiz_id = $${params.length}`;
      }
    }

    query += ' ORDER BY a.started_at DESC';

    const result = await pool.query(query, params);
    const rows = result.rows.map((r) => ({
      ...r,
      pass_percentage: Number(r.pass_percentage),
      percentage: r.percentage === null ? null : Number(r.percentage),
      duration_seconds: r.duration_seconds === null ? null : Number(r.duration_seconds)
    }));
    res.json(rows);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// get questions + saved answers + time left for a running attempt
router.get('/:attemptId', authorize(ROLES.STUDENT), async (req, res) => {
  const attemptId = toId(req.params.attemptId);
  if (!attemptId) {
    return res.status(400).json({ message: 'Invalid attempt id' });
  }

  try {
    const attempt = await findAttempt(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    if (attempt.student_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only access your own attempt' });
    }

    // correct_answer and explanation are NOT sent here
    const questionsRes = await pool.query(
      'SELECT id, question_text, question_type, options, marks FROM questions WHERE quiz_id = $1 ORDER BY id',
      [attempt.quiz_id]
    );
    const answersRes = await pool.query(
      'SELECT question_id, given_answer FROM attempt_answers WHERE attempt_id = $1',
      [attemptId]
    );

    const savedAnswers = {};
    answersRes.rows.forEach((row) => {
      savedAnswers[row.question_id] = row.given_answer;
    });

    const deadline = getDeadline(attempt.started_at, attempt.time_limit_minutes, attempt.end_time);
    const timeLeftSeconds = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));

    res.json({
      attemptId: attempt.id,
      quizId: attempt.quiz_id,
      title: attempt.title,
      status: attempt.status,
      deadline,
      timeLeftSeconds,
      questions: questionsRes.rows,
      savedAnswers
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// autosave answers while the student is doing the quiz (#19)
router.put('/:attemptId/answers', authorize(ROLES.STUDENT), async (req, res) => {
  const attemptId = toId(req.params.attemptId);
  if (!attemptId) {
    return res.status(400).json({ message: 'Invalid attempt id' });
  }
  const answers = (req.body || {}).answers;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // lock the attempt so this does not mix with a submit happening at the same time
    const attemptRes = await client.query(
      `SELECT a.*, q.time_limit_minutes, q.end_time
       FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.id = $1
       FOR UPDATE OF a`,
      [attemptId]
    );
    const attempt = attemptRes.rows[0];

    if (!attempt) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Attempt not found' });
    }
    if (attempt.student_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'You can only access your own attempt' });
    }
    if (attempt.status === 'SUBMITTED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'This attempt is already submitted' });
    }

    const deadline = getDeadline(attempt.started_at, attempt.time_limit_minutes, attempt.end_time);
    if (isPastGrace(deadline)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Time is over, answers cannot be changed now' });
    }

    const questionsRes = await client.query('SELECT * FROM questions WHERE quiz_id = $1', [attempt.quiz_id]);
    const error = validateAnswers(answers, questionsRes.rows);
    if (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: error });
    }

    await saveAnswers(client, attemptId, answers);
    await client.query('COMMIT');

    res.json({ message: 'Answers saved', savedAt: new Date() });
  } catch (err) {
    await client.query('ROLLBACK');
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// submit the quiz (#9)
// body: { answers: [...], auto: true/false }  auto = true when the timer ran out
router.post('/:attemptId/submit', authorize(ROLES.STUDENT), async (req, res) => {
  const attemptId = toId(req.params.attemptId);
  if (!attemptId) {
    return res.status(400).json({ message: 'Invalid attempt id' });
  }
  const body = req.body || {};
  if (body.answers !== undefined && !Array.isArray(body.answers)) {
    return res.status(400).json({ message: 'Answers should be a list' });
  }

  try {
    const attempt = await findAttempt(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    if (attempt.student_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only submit your own attempt' });
    }

    const done = await submitAttempt(attemptId, body.answers || [], body.auto ? 'AUTO' : 'MANUAL');

    // send the result back straight away so it can be shown immediately (#11)
    const finished = await findAttempt(attemptId);
    res.json({
      message: done.alreadySubmitted ? 'Quiz was already submitted' : 'Quiz submitted',
      result: formatResult(finished)
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// result of an attempt (#11)
// student can see only their own result, teacher and admin can see any
router.get('/:attemptId/result', async (req, res) => {
  const attemptId = toId(req.params.attemptId);
  if (!attemptId) {
    return res.status(400).json({ message: 'Invalid attempt id' });
  }

  try {
    const attempt = await findAttempt(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    if (req.user.role === ROLES.STUDENT && attempt.student_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only view your own result' });
    }
    if (attempt.status !== 'SUBMITTED') {
      return res.status(400).json({ message: 'Result will be shown after the quiz is submitted' });
    }
    res.json(formatResult(attempt));
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// review answers for a submitted attempt (#13)
// allows students to see their answers vs correct answers and explanations
router.get('/:attemptId/review', async (req, res) => {
  const attemptId = toId(req.params.attemptId);
  if (!attemptId) {
    return res.status(400).json({ message: 'Invalid attempt id' });
  }

  try {
    const attempt = await findAttempt(attemptId);
    if (!attempt) {
      return res.status(404).json({ message: 'Attempt not found' });
    }
    if (req.user.role === ROLES.STUDENT && attempt.student_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only review your own attempt' });
    }
    if (attempt.status !== 'SUBMITTED') {
      return res.status(400).json({ message: 'Answer review is only available after submitting the quiz' });
    }

    const questionsRes = await pool.query(
      'SELECT id, question_text, question_type, options, correct_answer, explanation, marks FROM questions WHERE quiz_id = $1 ORDER BY id',
      [attempt.quiz_id]
    );

    const answersRes = await pool.query(
      'SELECT question_id, given_answer, is_correct FROM attempt_answers WHERE attempt_id = $1',
      [attemptId]
    );

    const answerMap = {};
    answersRes.rows.forEach((row) => {
      answerMap[row.question_id] = {
        givenAnswer: row.given_answer,
        isCorrect: row.is_correct
      };
    });

    const reviewedQuestions = questionsRes.rows.map((q) => {
      const ans = answerMap[q.id] || { givenAnswer: null, isCorrect: false };
      return {
        id: q.id,
        questionText: q.question_text,
        questionType: q.question_type,
        options: q.options,
        marks: q.marks,
        earnedMarks: ans.isCorrect ? q.marks : 0,
        givenAnswer: ans.givenAnswer,
        correctAnswer: q.correct_answer,
        isCorrect: ans.isCorrect,
        explanation: q.explanation
      };
    });

    res.json({
      attemptId: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.title,
      score: attempt.score,
      totalMarks: attempt.total_marks,
      percentage: Number(attempt.percentage),
      passPercentage: Number(attempt.pass_percentage),
      passed: attempt.passed,
      submittedAt: attempt.submitted_at,
      submitType: attempt.submit_type,
      questions: reviewedQuestions
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

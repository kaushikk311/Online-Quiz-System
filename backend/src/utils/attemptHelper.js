// extra seconds allowed after time is over, for slow internet
// (answers reaching the server late because of network delay)
const GRACE_SECONDS = 30;

// attempt ends when time limit is over OR when quiz window closes, whichever comes first
function getDeadline(startedAt, timeLimitMinutes, quizEndTime) {
  const byTimer = new Date(startedAt).getTime() + timeLimitMinutes * 60 * 1000;
  const byWindow = new Date(quizEndTime).getTime();
  return new Date(Math.min(byTimer, byWindow));
}

function isPastGrace(deadline) {
  return Date.now() > deadline.getTime() + GRACE_SECONDS * 1000;
}

// the browser timer can reach 0 a second or two before the server time does
const AUTO_SUBMIT_MARGIN_SECONDS = 5;

// decides if a submit is MANUAL or AUTO (#9)
// askedForAuto is what the browser sent. it is not just believed, otherwise a student
// could send auto = true early to make it look like the time ran out
function getSubmitType(askedForAuto, deadline) {
  const now = Date.now();
  if (now > deadline.getTime()) {
    return 'AUTO';
  }
  if (askedForAuto && now >= deadline.getTime() - AUTO_SUBMIT_MARGIN_SECONDS * 1000) {
    return 'AUTO';
  }
  return 'MANUAL';
}

// checks the answers sent from frontend before saving them
// answers should look like [{ questionId: 1, answer: 'TRUNCATE' }, ...]
// returns an error message if something is wrong, otherwise null
function validateAnswers(answers, questions) {
  if (!Array.isArray(answers)) {
    return 'Answers should be a list';
  }

  const questionMap = {};
  questions.forEach((q) => {
    questionMap[q.id] = q;
  });

  const seen = new Set();

  for (const item of answers) {
    if (!item || typeof item !== 'object') {
      return 'Invalid answer format';
    }

    const q = questionMap[item.questionId];
    if (!q) {
      return 'Question ' + item.questionId + ' is not part of this quiz';
    }
    if (seen.has(q.id)) {
      return 'Question ' + q.id + ' is answered more than once';
    }
    seen.add(q.id);

    // empty means student left it blank, that is fine
    if (item.answer === null || item.answer === undefined || item.answer === '') {
      continue;
    }

    if (typeof item.answer !== 'string') {
      return 'Answer for question ' + q.id + ' must be text';
    }
    if (item.answer.length > 500) {
      return 'Answer for question ' + q.id + ' is too long';
    }
    if (q.question_type === 'MCQ' && !(q.options || []).includes(item.answer)) {
      return 'Invalid option selected for question ' + q.id;
    }
    if (q.question_type === 'TRUE_FALSE' && item.answer !== 'True' && item.answer !== 'False') {
      return 'Answer for question ' + q.id + ' must be True or False';
    }
  }

  return null;
}

module.exports = { GRACE_SECONDS, getDeadline, isPastGrace, getSubmitType, validateAnswers };

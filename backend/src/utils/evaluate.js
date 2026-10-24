// automatic evaluation of a quiz attempt (#10)

// makes answer lower case and removes extra spaces
// so "  Process " and "process" are treated same
function normalize(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function checkAnswer(question, givenAnswer) {
  if (givenAnswer === undefined || givenAnswer === null || normalize(givenAnswer) === '') {
    return false; // not answered
  }
  return normalize(givenAnswer) === normalize(question.correct_answer);
}

// questions -> rows from questions table
// answers   -> object like { questionId: answerText }
// returns score, total marks, percentage, pass/fail and which ones are correct
function evaluateAttempt(questions, answers, passPercentage) {
  let score = 0;
  let total = 0;
  const results = [];

  for (const q of questions) {
    total += q.marks;
    const isCorrect = checkAnswer(q, answers[q.id]);
    if (isCorrect) {
      score += q.marks;
    }
    results.push({ questionId: q.id, isCorrect });
  }

  let percentage = 0;
  if (total > 0) {
    percentage = Math.round((score / total) * 10000) / 100; // 2 decimal places
  }

  return {
    score,
    total,
    percentage,
    passed: percentage >= passPercentage,
    results
  };
}

module.exports = { checkAnswer, evaluateAttempt };

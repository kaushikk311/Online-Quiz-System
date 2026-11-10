// Pure scoring + snapshot helpers (UC04, UC09).
export const normalize = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const round = (n, p) => Math.round(n * 10 ** p) / 10 ** p;

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Copies the quiz's questions so later edits never change an attempt. Optionally randomises order. */
export function buildSnapshot(quiz, allQuestions, { shuffleQuestions, shuffleOptions, random = Math.random } = {}) {
  let qs = (quiz.questionIds || []).map((id) => allQuestions.find((q) => q.id === id)).filter(Boolean)
    .map((q) => ({
      id: q.id, type: q.type, text: q.text, correct: q.correct, explanation: q.explanation || '',
      options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
    }));
  if (shuffleQuestions) qs = shuffle(qs, random);
  // Only MCQs support option re-ordering; True/False and Fill-in-the-Blank keep their supported format.
  if (shuffleOptions) qs = qs.map((q) => (q.type === 'mcq' ? { ...q, options: shuffle(q.options, random) } : q));
  return qs;
}

/** 'correct' | 'incorrect' | 'unanswered' | 'invalid' */
export function checkAnswer(q, a) {
  if (a === undefined || a === null || (typeof a === 'string' && a.trim() === '')) return 'unanswered';
  if (typeof a !== 'string') return 'invalid';
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || !q.options.some((o) => o.id === a)) return 'invalid';
    return a === q.correct ? 'correct' : 'incorrect';          // compare by option id, never by position
  }
  if (q.type === 'tf') {
    if (a !== 'true' && a !== 'false') return 'invalid';
    return a === q.correct ? 'correct' : 'incorrect';
  }
  if (q.type === 'fib') {
    const accepted = String(q.correct).split('|').map(normalize);
    return accepted.includes(normalize(a)) ? 'correct' : 'incorrect';
  }
  return 'invalid';
}

export function evaluate(attempt) {
  const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
  const answers = attempt.answers && typeof attempt.answers === 'object' ? attempt.answers : {};
  const penalty = Number(attempt.scoring?.unansweredPenalty) || 0;
  const pass = Number(attempt.scoring?.passingPercentage) || 0;
  let correct = 0, incorrect = 0, unanswered = 0, invalid = 0;
  const items = questions.map((q) => {
    const status = checkAnswer(q, answers[q.id]);
    if (status === 'correct') correct++;
    else if (status === 'incorrect') incorrect++;
    else if (status === 'unanswered') unanswered++;
    else invalid++;                                              // corrupt data is never awarded marks
    return { questionId: q.id, status };
  });
  const total = questions.length;
  const raw = Math.max(0, correct - penalty * unanswered);
  const score = round(raw, 2);
  const pctExact = total ? (raw / total) * 100 : 0;
  return {
    score, total, correct, incorrect, unanswered, invalid, items,
    percentage: round(pctExact, 1),
    passed: total > 0 && pctExact >= pass,
  };
}

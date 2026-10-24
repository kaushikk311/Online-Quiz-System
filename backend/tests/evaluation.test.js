// tests for automatic evaluation (#10) and answer checking (#19)

const { checkAnswer, evaluateAttempt } = require('../src/utils/evaluate');
const { getDeadline, validateAnswers } = require('../src/utils/attemptHelper');

const questions = [
  { id: 1, question_type: 'MCQ', options: ['DELETE', 'DROP', 'TRUNCATE', 'REMOVE'], correct_answer: 'TRUNCATE', marks: 1 },
  { id: 2, question_type: 'TRUE_FALSE', options: null, correct_answer: 'False', marks: 1 },
  { id: 3, question_type: 'FILL_BLANK', options: null, correct_answer: 'process', marks: 2 }
];

describe('checkAnswer', () => {
  test('correct mcq answer', () => {
    expect(checkAnswer(questions[0], 'TRUNCATE')).toBe(true);
  });

  test('wrong mcq answer', () => {
    expect(checkAnswer(questions[0], 'DROP')).toBe(false);
  });

  test('fill in the blank ignores case and extra spaces', () => {
    expect(checkAnswer(questions[2], '  Process ')).toBe(true);
  });

  test('empty answer is wrong', () => {
    expect(checkAnswer(questions[2], '')).toBe(false);
    expect(checkAnswer(questions[2], null)).toBe(false);
    expect(checkAnswer(questions[2], undefined)).toBe(false);
  });
});

describe('evaluateAttempt', () => {
  test('all correct gives full marks and pass', () => {
    const r = evaluateAttempt(questions, { 1: 'TRUNCATE', 2: 'False', 3: 'process' }, 50);
    expect(r.score).toBe(4);
    expect(r.total).toBe(4);
    expect(r.percentage).toBe(100);
    expect(r.passed).toBe(true);
  });

  test('marks of each question are used', () => {
    // only q3 correct which is 2 marks out of 4
    const r = evaluateAttempt(questions, { 1: 'DROP', 2: 'True', 3: 'process' }, 50);
    expect(r.score).toBe(2);
    expect(r.percentage).toBe(50);
    expect(r.passed).toBe(true); // 50 >= 50
  });

  test('below pass percentage is fail', () => {
    const r = evaluateAttempt(questions, { 1: 'TRUNCATE' }, 50);
    expect(r.score).toBe(1);
    expect(r.percentage).toBe(25);
    expect(r.passed).toBe(false);
  });

  test('nothing answered gives zero', () => {
    const r = evaluateAttempt(questions, {}, 40);
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.results.every((x) => x.isCorrect === false)).toBe(true);
  });

  test('percentage is rounded to 2 decimals', () => {
    const three = [
      { id: 1, correct_answer: 'a', marks: 1 },
      { id: 2, correct_answer: 'b', marks: 1 },
      { id: 3, correct_answer: 'c', marks: 1 }
    ];
    const r = evaluateAttempt(three, { 1: 'a' }, 40);
    expect(r.percentage).toBe(33.33);
  });
});

describe('validateAnswers', () => {
  test('valid answers give no error', () => {
    const err = validateAnswers([{ questionId: 1, answer: 'DROP' }, { questionId: 3, answer: 'thread' }], questions);
    expect(err).toBeNull();
  });

  test('blank answers are allowed', () => {
    expect(validateAnswers([{ questionId: 2, answer: '' }], questions)).toBeNull();
  });

  test('not a list', () => {
    expect(validateAnswers('TRUNCATE', questions)).not.toBeNull();
  });

  test('question from some other quiz', () => {
    expect(validateAnswers([{ questionId: 50, answer: 'x' }], questions)).not.toBeNull();
  });

  test('option that is not in the mcq', () => {
    expect(validateAnswers([{ questionId: 1, answer: 'SELECT' }], questions)).not.toBeNull();
  });

  test('true/false with some other value', () => {
    expect(validateAnswers([{ questionId: 2, answer: 'yes' }], questions)).not.toBeNull();
  });

  test('same question twice', () => {
    const err = validateAnswers([{ questionId: 1, answer: 'DROP' }, { questionId: 1, answer: 'TRUNCATE' }], questions);
    expect(err).not.toBeNull();
  });

  test('answer that is not text', () => {
    expect(validateAnswers([{ questionId: 3, answer: 123 }], questions)).not.toBeNull();
  });
});

describe('getDeadline', () => {
  test('uses time limit when quiz window is still open', () => {
    const start = new Date('2026-10-20T10:00:00Z');
    const end = new Date('2026-10-30T10:00:00Z');
    expect(getDeadline(start, 10, end).toISOString()).toBe('2026-10-20T10:10:00.000Z');
  });

  test('uses quiz end time if that comes first', () => {
    const start = new Date('2026-10-20T10:00:00Z');
    const end = new Date('2026-10-20T10:05:00Z');
    expect(getDeadline(start, 10, end).toISOString()).toBe('2026-10-20T10:05:00.000Z');
  });
});

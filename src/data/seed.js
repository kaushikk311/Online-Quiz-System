import { now } from '../services/clock.js';
import { hashPassword } from '../services/hash.js';
import { buildSnapshot, evaluate } from '../services/scoring.js';

const H = 3600e3, D = 24 * H;
const mcq = (id, text, opts, correct, explanation, categoryId) => ({
  id, type: 'mcq', text, correct, explanation, categoryId,
  options: opts.map((t, i) => ({ id: 'abcdef'[i], text: t })),
});
const tf = (id, text, correct, explanation, categoryId) => ({ id, type: 'tf', text, correct, explanation, categoryId });
const fib = (id, text, correct, explanation, categoryId) => ({ id, type: 'fib', text, correct, explanation, categoryId });

export function buildSeed() {
  const t = now();

  const users = [
    { id: 'u_admin', name: 'Aditi Admin', username: 'admin', role: 'admin', pw: 'admin123' },
    { id: 'u_teacher', name: 'Ms. Rao', username: 'teacher', role: 'teacher', pw: 'teacher123' },
    { id: 'u_alice', name: 'Alice Johnson', username: 'alice', role: 'student', pw: 'student123' },
    { id: 'u_bob', name: 'Bob Martin', username: 'bob', role: 'student', pw: 'student123' },
    { id: 'u_carol', name: 'Carol Singh', username: 'carol', role: 'student', pw: 'student123' },
    { id: 'u_dan', name: 'Dan Lee', username: 'dan', role: 'student', pw: 'student123' },
  ].map(({ pw, ...u }) => ({ ...u, passwordHash: hashPassword(pw) }));

  const categories = [
    { id: 'c_cs', name: 'Computer Science', description: 'Programming, web and computing fundamentals.' },
    { id: 'c_sci', name: 'Science', description: 'Physics, chemistry and biology.' },
    { id: 'c_math', name: 'Mathematics', description: 'Arithmetic, algebra and geometry.' },
    { id: 'c_gk', name: 'General Knowledge', description: 'Geography, literature and the world around us.' },
  ];

  const questions = [
    mcq('q1', 'Which HTML tag creates a hyperlink?', ['<a>', '<link>', '<href>', '<url>'], 'a', 'The <a> (anchor) tag creates hyperlinks. href is only an attribute of it.', 'c_cs'),
    tf('q2', 'CSS stands for Cascading Style Sheets.', 'true', 'CSS is the language used to describe how HTML is presented: Cascading Style Sheets.', 'c_cs'),
    fib('q3', 'The JavaScript array method that adds an item to the end is ____.', 'push', 'Array.prototype.push() appends one or more items to the end of an array.', 'c_cs'),
    mcq('q4', 'Which HTTP status code means "Not Found"?', ['200', '301', '404', '500'], 'c', '404 means the server could not find the requested resource.', 'c_cs'),
    tf('q5', 'JavaScript and Java are the same language.', 'false', 'They are unrelated languages that only share part of a name.', 'c_cs'),
    mcq('q6', 'What is the chemical formula of water?', ['H2O', 'CO2', 'O2', 'NaCl'], 'a', 'Water is two hydrogen atoms bonded to one oxygen atom: H2O.', 'c_sci'),
    tf('q7', 'Light travels faster than sound.', 'true', 'Light moves at about 300,000 km/s; sound in air at about 343 m/s.', 'c_sci'),
    fib('q8', 'The planet known as the Red Planet is ____.', 'Mars', 'Iron oxide on its surface gives Mars its red colour.', 'c_sci'),
    mcq('q9', 'Which gas do plants absorb for photosynthesis?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 'b', 'Plants take in carbon dioxide and release oxygen.', 'c_sci'),
    mcq('q10', 'What is 12 × 12?', ['124', '144', '164', '134'], 'b', '12 × 12 = 144.', 'c_math'),
    fib('q11', 'The square root of 81 is ____.', '9|nine', '9 × 9 = 81, so the square root of 81 is 9.', 'c_math'),
    tf('q12', 'The interior angles of a triangle add up to 180 degrees.', 'true', 'In Euclidean geometry every triangle’s angles sum to 180°.', 'c_math'),
    mcq('q13', 'Solve 3x + 5 = 20. What is x?', ['3', '4', '5', '6'], 'c', 'Subtract 5 from both sides (3x = 15), then divide by 3: x = 5.', 'c_math'),
    mcq('q14', 'Which is the largest ocean on Earth?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 'd', 'The Pacific Ocean covers about a third of Earth’s surface.', 'c_gk'),
    tf('q15', 'Mount Everest is located in the Alps.', 'false', 'Everest is in the Himalayas, on the Nepal–China border.', 'c_gk'),
    fib('q16', 'The capital of France is ____.', 'Paris', 'Paris has been the capital of France for centuries.', 'c_gk'),
    mcq('q17', 'Who wrote "Romeo and Juliet"?', ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'George Orwell'], 'b', 'William Shakespeare wrote the tragedy in the 1590s.', 'c_gk'),
  ].map((q) => ({ ...q, createdBy: 'u_teacher' }));

  const base = { unansweredPenalty: 0, shuffleQuestions: false, shuffleOptions: false, createdBy: 'u_teacher', createdAt: t - 7 * D };
  const quizzes = [
    { ...base, id: 'qz_web', title: 'Web Development Basics', subjectId: 'c_cs', timeLimit: 10, passingPercentage: 60, maxAttempts: 3,
      shuffleQuestions: true, shuffleOptions: true, questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'], startTime: t - D, endTime: t + 7 * D },
    { ...base, id: 'qz_sci', title: 'Quick Science Check', subjectId: 'c_sci', timeLimit: 1, passingPercentage: 60, maxAttempts: 1,
      questionIds: ['q6', 'q7', 'q8'], startTime: t - 2 * H, endTime: t + 3 * D },
    { ...base, id: 'qz_gk', title: 'General Knowledge Mix', subjectId: 'c_gk', timeLimit: 8, passingPercentage: 50, maxAttempts: 2,
      unansweredPenalty: 0.25, questionIds: ['q14', 'q15', 'q16', 'q17'], startTime: t - 3 * D, endTime: t + 10 * D },
    { ...base, id: 'qz_math', title: 'Math Mastery Test', subjectId: 'c_math', timeLimit: 15, passingPercentage: 70, maxAttempts: 1,
      questionIds: ['q10', 'q11', 'q12', 'q13'], startTime: t + 2 * D, endTime: t + 3 * D },
    { ...base, id: 'qz_old', title: 'Earth & Space Warm-up', subjectId: 'c_sci', timeLimit: 5, passingPercentage: 50, maxAttempts: 2,
      questionIds: ['q9', 'q7'], startTime: t - 6 * D, endTime: t - D },
  ];

  const mk = (id, quizId, userId, answers, daysAgo, seconds) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    const startedAt = t - daysAgo * D;
    const a = {
      id, quizId, quizTitle: quiz.title, userId, status: 'submitted', startedAt, timeLimit: quiz.timeLimit,
      deadline: startedAt + quiz.timeLimit * 60000, submittedAt: startedAt + seconds * 1000, submitReason: 'manual',
      timeTaken: seconds, questions: buildSnapshot(quiz, questions), answers,
      scoring: { unansweredPenalty: quiz.unansweredPenalty, passingPercentage: quiz.passingPercentage },
    };
    a.result = evaluate(a);
    return a;
  };

  const attempts = [
    mk('at_s1', 'qz_gk', 'u_alice', { q14: 'd', q15: 'false', q16: 'Paris', q17: 'b' }, 2, 185),
    mk('at_s2', 'qz_gk', 'u_bob', { q14: 'd', q15: 'true', q16: 'paris', q17: 'b' }, 2, 240),
    mk('at_s3', 'qz_gk', 'u_carol', { q14: 'd', q15: 'false', q16: 'Lyon', q17: 'b' }, 1, 300),
    mk('at_s4', 'qz_gk', 'u_dan', { q14: 'a', q15: 'true' }, 1, 120),
    mk('at_s5', 'qz_sci', 'u_bob', { q6: 'a', q7: 'true', q8: 'Venus' }, 0.05, 45),
  ];

  const feedback = [
    { id: 'fb1', quizId: 'qz_gk', userId: 'u_alice', rating: 5, comment: 'Clear questions and fair timing.', createdAt: t - D },
    { id: 'fb2', quizId: 'qz_gk', userId: 'u_bob', rating: 4, comment: '', createdAt: t - D / 2 },
    { id: 'fb3', quizId: 'qz_gk', userId: 'u_carol', rating: 4, comment: 'Enjoyed the mix of formats.', createdAt: t - D / 3 },
  ];

  return { users, categories, questions, quizzes, attempts, feedback };
}

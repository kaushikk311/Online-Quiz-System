// Generates draft questions from book text — no AI, no server. Pure rules over the text itself:
// it finds informative sentences, blanks out the key term (fill-in-the-blank / MCQ) or keeps / alters
// the sentence (true/false). Every draft carries the source sentence as its explanation.
import { updateDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';
import { random, uid } from './clock.js';
import { shuffle } from './scoring.js';
import { validateQuestion } from './questions.js';

const STOP = new Set(('a an the and or but if then than that this these those with without from into onto over under about above below between among through during before after while for of to in on at by as is are was were be been being am do does did done have has had having it its itself they them their theirs he him his she her hers we us our you your i me my not no nor so such can could may might must shall should will would also very more most much many some any each other another which who whom whose what when where why how there here only own same too just both either neither one two three first second however therefore thus hence because since although though whereas often usually generally called known used using use').split(' '));
const DEFINITIONAL = /\b(is|are|refers? to|means?|defined as|known as|called|consists? of|involves?|occurs?|produces?|contains?)\b/i;
const MAX_PER_TYPE = 15;

/** Splits raw text into roughly page-sized sections so a teacher can pick a range. */
export function splitSections(raw, size = 3000) {
  const paras = String(raw).replace(/\r/g, '').split(/\n\s*\n|\f/).map((p) => p.trim()).filter(Boolean);
  const sections = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > size) { sections.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) sections.push(cur);
  return sections.map((text, i) => ({ index: i, label: `Section ${i + 1}`, text }));
}

export function splitSentences(text) {
  const clean = String(text).replace(/\r/g, '').replace(/-\n/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.split(/(?<=[.!?])\s+(?=[A-Z“"(])/).map((s) => s.trim()).filter((s) => {
    const n = s.split(' ').length;
    return n >= 8 && n <= 35 && /[.!]$/.test(s) && (s.match(/\d/g) || []).length <= 6 && !/^(figure|fig\.|table|chapter|page|copyright|isbn)/i.test(s);
  });
}

const tokens = (s) => s.match(/[A-Za-z][A-Za-z'-]{3,}/g) || [];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isCap = (w) => /^[A-Z]/.test(w);
// rough word class so wrong options look like the answer (noun-ish vs verb-ish vs -ing)
const wordClass = (w) => (/ing$/i.test(w) ? 'g' : /(ed|ly)$/i.test(w) || /^(splits|releases|carries|takes|uses|builds|controls)$/i.test(w) ? 'v' : 'n');

function termStats(text) {
  const freq = new Map(), surface = new Map();
  for (const w of tokens(text)) {
    const k = w.toLowerCase();
    if (STOP.has(k)) continue;
    freq.set(k, (freq.get(k) || 0) + 1);
    const s = surface.get(k) || new Map();
    s.set(w, (s.get(w) || 0) + 1);
    surface.set(k, s);
  }
  const form = (k) => [...surface.get(k).entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { freq, form };
}

/** Up to three candidate answer words for a sentence, best first. */
function answerOptions(sentence, stats) {
  const out = [];
  tokens(sentence).forEach((w, i) => {
    const k = w.toLowerCase();
    if (STOP.has(k) || !stats.freq.has(k)) return;
    const occurrences = (sentence.match(new RegExp(`\\b${esc(w)}\\b`, 'gi')) || []).length;
    if (occurrences !== 1) return;                                   // must be unambiguous inside the sentence
    out.push({ word: w, score: Math.min(stats.freq.get(k), 6) + (isCap(w) && i > 0 ? 2 : 0) + Math.min(w.length, 10) / 5 });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

function distractors(answer, sentence, stats, n) {
  const a = answer.toLowerCase(), inSentence = new Set(tokens(sentence).map((w) => w.toLowerCase()));
  const pool = [...stats.freq.keys()].filter((k) => k !== a && !inSentence.has(k) && k.slice(0, 5) !== a.slice(0, 5)
    && Math.abs(k.length - a.length) <= Math.max(3, a.length * 0.4) && isCap(stats.form(k)) === isCap(answer) && wordClass(k) === wordClass(answer));
  const top = pool.sort((x, y) => stats.freq.get(y) - stats.freq.get(x)).slice(0, 40);
  return shuffle(top, random).slice(0, n).map((k) => (isCap(answer) ? stats.form(k) : stats.form(k).toLowerCase()));
}

const blank = (sentence, answer) => sentence.replace(new RegExp(`\\b${esc(answer)}\\b`), '____');
const swap = (sentence, answer, other) => sentence.replace(new RegExp(`\\b${esc(answer)}\\b`), other);

/**
 * counts: { mcq, tf, fib }. Returns drafts the teacher must review — nothing is saved here.
 */
export const generateFromText = (actor, { text, counts }) => guard(() => {
  const a = authorize(actor, 'question.manage'); if (!a.ok) return a;
  const c = { mcq: Number(counts?.mcq) || 0, tf: Number(counts?.tf) || 0, fib: Number(counts?.fib) || 0 };
  const errors = {};
  for (const [k, v] of Object.entries(c)) if (!Number.isInteger(v) || v < 0 || v > MAX_PER_TYPE) errors.counts = `Ask for between 0 and ${MAX_PER_TYPE} questions of each type.`;
  const requested = c.mcq + c.tf + c.fib;
  if (!errors.counts && requested < 1) errors.counts = 'Choose at least one question to generate.';
  if (Object.keys(errors).length) return fail('VALIDATION', errors.counts, errors);
  const body = String(text || '').trim();
  if (body.length < 300) return fail('NOT_ENOUGH_TEXT', 'Add more text first — at least a few paragraphs are needed to write good questions.', { text: 'Not enough text.' });

  const sentences = splitSentences(body);
  const stats = termStats(body);
  const bonus = (sent) => (DEFINITIONAL.test(sent) ? 3 : 0);
  const cands = sentences.flatMap((sent, idx) => answerOptions(sent, stats).map((o) => ({ s: sent, idx, answer: o.word, score: o.score + bonus(sent) })))
    .sort((x, y) => y.score - x.score);
  if (new Set(cands.map((c) => c.idx)).size < 3) return fail('NOT_ENOUGH_TEXT', 'This text doesn’t contain enough clear, complete sentences. Try a different section.', { text: 'Not enough usable sentences.' });

  const usedSentence = new Set(), usedAnswer = new Set();
  const take = (build) => {
    for (const cand of cands) {
      if (usedSentence.has(cand.idx) || usedAnswer.has(cand.answer.toLowerCase())) continue;
      const q = build(cand);
      if (q && q.text.length <= 300) { usedSentence.add(cand.idx); usedAnswer.add(cand.answer.toLowerCase()); return q; }
    }
    return null;
  };
  const source = (s) => `From the text: “${s}”`;
  const drafts = [];

  for (let i = 0; i < c.mcq; i++) {
    const q = take((cd) => {
      const d = distractors(cd.answer, cd.s, stats, 3);
      if (d.length < 3) return null;
      const opts = shuffle([cd.answer, ...d], random).map((t, n) => ({ id: 'abcd'[n], text: t }));
      return { type: 'mcq', text: `Which term completes this sentence? ${blank(cd.s, cd.answer)}`, options: opts, correct: opts.find((o) => o.text === cd.answer).id, explanation: source(cd.s) };
    });
    if (q) drafts.push(q);
  }
  for (let i = 0; i < c.fib; i++) {
    const q = take((cd) => ({ type: 'fib', text: blank(cd.s, cd.answer), correct: cd.answer, explanation: source(cd.s) }));
    if (q) drafts.push(q);
  }
  for (let i = 0; i < c.tf; i++) {
    const wantFalse = i % 2 === 1;                                    // alternate so the set is balanced
    const q = take((cd) => {
      if (!wantFalse) return { type: 'tf', text: cd.s, correct: 'true', explanation: `Stated in the text: “${cd.s}”` };
      const [other] = distractors(cd.answer, cd.s, stats, 1);
      return other ? { type: 'tf', text: swap(cd.s, cd.answer, other), correct: 'false', explanation: `The text actually says: “${cd.s}”` } : null;
    });
    if (q) drafts.push(q);
  }
  const out = drafts.map((d) => ({ ...d, draftId: uid('d_') }));
  const warnings = out.length < requested ? [`Only ${out.length} of ${requested} questions could be written — the text didn’t have enough suitable sentences.`] : [];
  return ok({ drafts: out, requested, generated: out.length, warnings });
});

/** Saves accepted drafts into the question bank (and optionally into a quiz). Each one is re-validated. */
export const saveGeneratedQuestions = (actor, drafts, { categoryId = '', quizId = '', sourceTitle = '' } = {}) => guard(() => {
  const a = authorize(actor, 'question.manage'); if (!a.ok) return a;
  if (!Array.isArray(drafts) || !drafts.length) return fail('NO_SELECTION', 'Select at least one question to save.');
  return updateDb((db) => {
    const quiz = quizId ? db.quizzes.find((q) => q.id === quizId) : null;
    if (quizId && !quiz) return fail('NOT_FOUND', 'The quiz you chose no longer exists, so nothing was saved.');
    let saved = 0, skipped = 0;
    for (const d of drafts) {
      const input = { ...d, categoryId: categoryId || null };
      if (Object.keys(validateQuestion(db, input)).length) { skipped++; continue; }
      const q = { id: uid('q_'), type: d.type, text: d.text.trim(), correct: d.type === 'fib' ? String(d.correct).trim() : d.correct,
        explanation: d.explanation || '', categoryId: categoryId || null, createdBy: a.data.id, generated: true, source: sourceTitle || undefined };
      if (d.type === 'mcq') q.options = d.options.map((o) => ({ id: o.id, text: o.text.trim() }));
      db.questions.push(q);
      if (quiz) quiz.questionIds.push(q.id);
      saved++;
    }
    if (!saved) return fail('VALIDATION', 'None of the selected questions were valid, so nothing was saved.');
    return ok({ saved, skipped });
  });
});

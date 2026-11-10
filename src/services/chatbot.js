// A basic, rule-based quiz assistant. No AI and no server: it recognises common questions with keyword rules and
// answers from the signed-in person's own data, through the same services (and permissions) as the rest of the app.
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';
import { listQuizzes } from './quizzes.js';
import { listAttempts } from './attempts.js';
import { getLeaderboard, TIE_RULE } from './leaderboard.js';
import { classReport } from './reports.js';
import { formatDateTime, formatDuration } from '../utils/format.js';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const TITLE_STOP = new Set(['the', 'and', 'quiz', 'test', 'for', 'with']);
const has = (t, re) => re.test(t);

export const STARTERS = {
  student: ['Which quizzes are open?', 'How many attempts do I have left?', 'What happens when time runs out?', 'What was my last score?'],
  teacher: ['How do I create a quiz?', 'How do I generate questions from a book?', 'What is the pass rate?', 'How do I schedule a quiz?'],
  admin: ['How do I add a subject?', 'What is the pass rate?', 'Which quizzes are open?', 'How do reports work?'],
};

function matchQuizzes(t, quizzes) {
  const words = new Set(t.split(' '));
  const scored = quizzes.map((q) => {
    const toks = norm(q.title).split(' ').filter((w) => w.length >= 3 && !TITLE_STOP.has(w));
    return { q, score: toks.filter((w) => words.has(w) || (w.length >= 5 && [...words].some((x) => x.length >= 5 && (x.startsWith(w) || w.startsWith(x))))).length };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!scored.length) return { quiz: null, ambiguous: [] };
  const top = scored.filter((x) => x.score === scored[0].score);
  return top.length === 1 ? { quiz: top[0].q, ambiguous: [] } : { quiz: null, ambiguous: top.map((x) => x.q) };
}

const reply = (text, suggestions = [], quizId = undefined) => ({ text, suggestions, quizId });
const state = (q) => q.availability.message;

/** Ordered rules: the first one that matches wins. */
const RULES = [
  { id: 'cheat', roles: ['student'], test: (t) => has(t, /(give|tell|show|reveal|what('?s| is| are)|share).*(answers?|solutions?).*(question|quiz|test|exam|q\d)|answer (key|sheet)|cheat|correct answers? (for|to|of) (the |this )?(quiz|question|test)/) && !has(t, /(review|after|submitted|my attempt)/),
    run: () => reply('I can’t share answers to quiz questions — that wouldn’t be fair to everyone. Once you submit an attempt, open “Review answers” to see the correct answers and explanations for what you missed.', ['How do I review my answers?', 'Which quizzes are open?']) },
  { id: 'greet', test: (t) => has(t, /^(hi|hello|hey|help|start|menu|good (morning|afternoon|evening))\b|what can you (do|help)|how can you help/),
    run: ({ role }) => reply(role === 'student' ? 'Hi! I can tell you which quizzes are open, when they close, how long they are, your attempts left, your scores and your rank. Try one of these:' : 'Hi! I can answer questions about quizzes, scores and how to use Tickmark. Try one of these:', STARTERS[role]) },
  { id: 'generate', roles: ['teacher', 'admin'], test: (t) => has(t, /(generate|create|make|auto).*(questions?).*(book|pdf|text|chapter)|(book|pdf).*(questions?)/),
    run: () => reply('Go to Question bank → “Generate from book”. Upload a PDF, TXT or MD file (or paste text), choose the page range, how many multiple-choice, true/false and fill-in-the-blank questions you want, then review the drafts. Only the ones you select are saved, so always check the answers first.', ['How do I create a quiz?']) },
  { id: 'howCreate', roles: ['teacher', 'admin'], test: (t) => has(t, /(how|where).*(create|add|make|set ?up|new).*(quiz)/),
    run: () => reply('Open Quizzes → Create quiz. Enter a title, subject, time limit and passing percentage, then save. After that you can add new questions or import them from the question bank, and set the availability window.', ['How do I schedule a quiz?', 'How do I add questions?']) },
  { id: 'howQuestions', roles: ['teacher', 'admin'], test: (t) => has(t, /(how|where).*(add|create|import|edit|delete).*(question)/),
    run: () => reply('Open a quiz from Quizzes → Edit. Under Questions use “Add question” (multiple choice, true/false or fill in the blank) or “Import from question bank”. The Question bank page lets you edit, delete and filter questions by subject.') },
  { id: 'howSchedule', roles: ['teacher', 'admin'], test: (t) => has(t, /(how|where).*(schedule|availability|open|close|start).*(quiz)?|how.*schedule/),
    run: () => reply('Open the quiz (Quizzes → Edit) and fill in “Opens” and “Closes” under Availability window, then save. Students can only start the quiz between those times; the end time must be after the start time.') },
  { id: 'howCategory', roles: ['admin'], test: (t) => has(t, /(how|where).*(add|create|manage|edit|delete).*(subject|categor)/),
    run: () => reply('Open Subjects in the top bar. Enter a name (and optional description) and press Create subject. A subject that’s used by quizzes or questions can’t be deleted until they are moved elsewhere.') },
  { id: 'howReports', roles: ['teacher', 'admin'], test: (t) => has(t, /(how|where).*(report|analytic)|reports? work/),
    run: () => reply('Open Reports. “Class report” shows attempts, average, highest, lowest, pass rate and question difficulty for one quiz; “Student report” shows one student’s attempts and averages.') },
  { id: 'stats', roles: ['teacher', 'admin'], test: (t) => has(t, /(average|mean|pass rate|highest|lowest|top scor|who (scored|topped|got)|how many (students|attempts)|statistic|class (result|perform))/), needsQuiz: true,
    run: ({ actor, quiz }) => {
      const r = classReport(actor, quiz.id);
      if (!r.ok) return reply(r.error);
      const s = r.data.stats;
      if (!s.attempts) return reply(`Nobody has submitted “${quiz.title}” yet, so there are no statistics.`, [], quiz.id);
      return reply(`“${quiz.title}”: ${s.attempts} attempts by ${s.students} students. Average ${s.average}%, highest ${s.highest}%, lowest ${s.lowest}%, pass rate ${s.passRate}% (${s.passed} passed, ${s.failed} not passed). Top: ${r.data.rows[0].name} (${r.data.rows[0].percentage}%).`, ['Show the leaderboard'], quiz.id);
    } },
  { id: 'counts', roles: ['teacher', 'admin'], test: (t) => has(t, /how many (quizzes|quiz)/),
    run: ({ quizzes }) => reply(`There are ${quizzes.length} quizzes: ${quizzes.filter((q) => q.availability.open).length} open now, ${quizzes.filter((q) => q.availability.state === 'upcoming').length} upcoming and ${quizzes.filter((q) => q.availability.state === 'closed').length} closed.`) },
  { id: 'rating', test: (t) => has(t, /\b(rate|rating|ratings|stars?)\b|leave feedback|give feedback|feedback (form|on the quiz)/),
    run: () => reply('You can rate a quiz (1–5 stars, with an optional comment) once you have passed it. Use “Rate this quiz” on the quiz list or on your result screen. The quiz’s average rating updates straight away.') },
  { id: 'review', test: (t) => has(t, /(review|explanation|explain|my mistakes|see (my )?answers|what i got wrong)/),
    run: () => reply('After you submit, open My attempts → Review (or “Review answers” on your result). You’ll see your answer, the correct answer, and an explanation for each question you got wrong. Review isn’t available while an attempt is still in progress.') },
  { id: 'timer', test: (t) => has(t, /(time runs? out|timer|time('?s| is) up|auto.?submit|automatically submit|run out of time|out of time)/),
    run: () => reply('The countdown starts when you press Start and shows at the top of the quiz. If it reaches zero, your attempt is submitted automatically with every answer you had given, and you can’t change anything afterwards. You’ll see your score right away.') },
  { id: 'offline', test: (t) => has(t, /(offline|internet|connection|network|wifi|refresh|reload|close the (tab|browser)|lost power|crash)/),
    run: () => reply('Your answers are saved as you go. If you refresh or lose connection, open the quiz again and choose Resume — the timer keeps running from the original deadline. If you press Submit while offline it’s queued and sent automatically when you reconnect.') },
  { id: 'shuffle', test: (t) => has(t, /(random|shuffl|different order|order of (the )?(questions|options))/),
    run: ({ quiz }) => reply(quiz ? `${quiz.title}: questions are ${quiz.shuffleQuestions ? 'shuffled' : 'in a fixed order'} and answer options are ${quiz.shuffleOptions ? 'shuffled' : 'in a fixed order'}. Scoring always follows the correct answer, not its position.` : 'Teachers can switch on shuffling of question order and multiple-choice options for each quiz. Scoring always follows the correct answer, not its position. True/False and fill-in-the-blank keep their fixed format.', [], quiz?.id) },
  { id: 'unanswered', test: (t) => has(t, /(unanswered|skip|negative marking|penalt|deduct|leave (it )?blank)/),
    run: ({ quiz }) => reply(quiz ? `On “${quiz.title}”, unanswered questions ${quiz.unansweredPenalty ? `lose ${quiz.unansweredPenalty} mark each` : 'score 0 with no penalty'}.` : 'Each quiz has its own rule: either unanswered questions simply score 0, or a small deduction applies. Ask me about a specific quiz to see its rule.', [], quiz?.id) },
  { id: 'ties', test: (t) => has(t, /\b(tie|ties|tied|same score)\b/), run: () => reply(TIE_RULE) },
  { id: 'rank', test: (t) => has(t, /(rank|position|leaderboard|standing|where do i stand|top of)/), needsQuiz: true,
    run: ({ actor, role, quiz }) => {
      const r = getLeaderboard(actor, quiz.id);
      if (!r.ok) return reply(r.error);
      const e = r.data.entries;
      if (!e.length) return reply(`No one has finished “${quiz.title}” yet, so there’s no leaderboard.`, [], quiz.id);
      if (role !== 'student') return reply(`Top of “${quiz.title}”: ${e.slice(0, 3).map((x) => `#${x.rank} ${x.name} (${x.score}/${x.total})`).join(', ')}.`, [], quiz.id);
      const me = e.find((x) => x.userId === actor.id);
      return reply(me ? `On “${quiz.title}” you’re ranked #${me.rank} of ${e.length} with ${me.score}/${me.total}${me.tied ? ' (tied with another student)' : ''}.` : `You haven’t submitted “${quiz.title}” yet, so you’re not on its leaderboard.`, ['How are ties handled?'], quiz.id);
    } },
  { id: 'score', roles: ['student'], test: (t) => has(t, /(my (score|result|results|marks|grade|percentage|attempts?)|how did i (do|go)|did i pass|last (attempt|result|score)|latest (result|score))/),
    run: ({ actor, quiz }) => {
      const r = listAttempts(actor);
      if (!r.ok) return reply(r.error);
      const done = r.data.rows.filter((x) => x.status === 'submitted' && (!quiz || x.quizId === quiz.id));
      if (!done.length) return reply(quiz ? `You haven’t submitted “${quiz.title}” yet.` : 'You haven’t submitted any quiz yet.', ['Which quizzes are open?'], quiz?.id);
      const last = done[0], best = Math.max(...done.map((x) => x.percentage));
      return reply(`Your latest result${quiz ? '' : ` (${last.quizTitle})`}: ${last.score}/${last.total} (${last.percentage}%) — ${last.passed ? 'Passed' : 'Not passed'}, taking ${formatDuration(last.timeTaken)} on ${formatDateTime(last.startedAt)}. You’ve submitted ${done.length} attempt${done.length > 1 ? 's' : ''}; your best is ${best}%.`, ['What is my rank?'], quiz?.id || last.quizId);
    } },
  { id: 'attempts', test: (t) => has(t, /(attempts?|retake|try again|retry|how many (times|tries)|another go)/), needsQuiz: true,
    run: ({ role, quiz }) => reply(role === 'student'
      ? `“${quiz.title}”: ${quiz.maxAttempts == null ? 'unlimited attempts' : `${quiz.attemptsLeft} of ${quiz.maxAttempts} attempt${quiz.maxAttempts > 1 ? 's' : ''} left`}. ${state(quiz)}`
      : `“${quiz.title}” allows ${quiz.maxAttempts == null ? 'unlimited attempts' : `${quiz.maxAttempts} attempt${quiz.maxAttempts > 1 ? 's' : ''}`} per student.`, [], quiz.id) },
  { id: 'pass', test: (t) => has(t, /(pass(ing)? (mark|percent|percentage|score|grade)|pass mark|cut ?off|what (do i|score|percent).*(pass)|to pass)/), needsQuiz: true,
    run: ({ quiz }) => reply(`“${quiz.title}” is passed with ${quiz.passingPercentage}% or more.`, [], quiz.id) },
  { id: 'time', test: (t) => has(t, /(time limit|how long|duration|how many minutes|how much time)/), needsQuiz: true,
    run: ({ quiz }) => reply(`“${quiz.title}” has a time limit of ${quiz.timeLimit} minutes, counted from the moment the attempt starts.`, [], quiz.id) },
  { id: 'size', test: (t) => has(t, /(how many questions|number of questions|question types|what (kind|types?) of questions)/), needsQuiz: true,
    run: ({ quiz }) => reply(`“${quiz.title}” has ${quiz.questionCount} question${quiz.questionCount === 1 ? '' : 's'}. Questions can be multiple choice, true/false or fill in the blank.`, [], quiz.id) },
  { id: 'when', test: (t) => has(t, /\b(when|what time|closes?|closing|deadline|due|window|available until|schedule|start date|end date|opens (at|on))\b/), needsQuiz: true,
    run: ({ quiz }) => reply(quiz.startTime ? `“${quiz.title}” opens ${formatDateTime(quiz.startTime)} and closes ${formatDateTime(quiz.endTime)}. ${state(quiz)}` : `“${quiz.title}” hasn’t been scheduled yet.`, ['How long is it?'], quiz.id) },
  { id: 'closed', test: (t) => has(t, /(closed|expired|ended|missed)/),
    run: ({ quizzes }) => { const l = quizzes.filter((q) => q.availability.state === 'closed'); return reply(l.length ? `Closed quizzes: ${l.map((q) => q.title).join(', ')}.` : 'No quizzes are closed right now.'); } },
  { id: 'upcoming', test: (t) => has(t, /(upcoming|not (yet )?open|coming up|next quiz|scheduled quizzes)/),
    run: ({ quizzes }) => { const l = quizzes.filter((q) => q.availability.state === 'upcoming'); return reply(l.length ? `Upcoming: ${l.map((q) => `${q.title} (opens ${formatDateTime(q.startTime)})`).join('; ')}.` : 'There are no upcoming quizzes right now.'); } },
  { id: 'open', test: (t) => has(t, /(which|what|any|show|list|see).*(quiz|quizzes|tests?)|(open|available|active) (quiz|quizzes)|what can i (take|attempt)/),
    run: ({ quizzes }) => { const l = quizzes.filter((q) => q.availability.open); return l.length ? reply(`Open now: ${l.map((q) => `${q.title} (${q.timeLimit} min, until ${formatDateTime(q.endTime)})`).join('; ')}.`, ['Which quizzes are upcoming?']) : reply('No quizzes are open right now. Ask me about upcoming ones.', ['Which quizzes are upcoming?']); } },
  { id: 'howStart', roles: ['student'], test: (t) => has(t, /(how).*(start|begin|take|attempt|do) .*(quiz)?|start (a|the) quiz/),
    run: () => reply('Open Quizzes, choose a quiz that says “Open now” and press Start quiz. Answer using the bubbles, move with Next/Previous or the question numbers, then press Submit quiz — or let the timer submit for you.', ['What happens when time runs out?']) },
  { id: 'history', roles: ['student'], test: (t) => has(t, /(history|past attempts|previous attempts|all my attempts)/),
    run: () => reply('Open My attempts in the top bar to see the date, score and time taken for every attempt. Only you can see your own history.') },
];

export const askChatbot = (actor, message, ctx = {}) => guard(() => {
  const a = authorize(actor); if (!a.ok) return a;
  const text = String(message ?? '').trim().slice(0, 300);
  if (!text) return fail('EMPTY', 'Type a question first.');
  const role = a.data.role, t = norm(text);
  const ql = listQuizzes(actor);
  if (!ql.ok) return ql;
  const quizzes = ql.data;
  const m = matchQuizzes(t, quizzes);
  const followUp = has(t, /\b(it|this|that|same one)\b|^(and|what about)\b/) || t.split(' ').length <= 4;
  const named = m.quiz || (!m.ambiguous.length && followUp && ctx.quizId ? quizzes.find((q) => q.id === ctx.quizId) : null) || (quizzes.length === 1 ? quizzes[0] : null);

  for (const rule of RULES) {
    if (rule.roles && !rule.roles.includes(role)) continue;
    if (!rule.test(t)) continue;
    if (rule.needsQuiz && !named) {
      const options = (m.ambiguous.length ? m.ambiguous : quizzes).slice(0, 5);
      return ok(reply(options.length ? 'Which quiz do you mean?' : 'There are no quizzes yet.', options.map((q) => `${text.replace(/\?$/, '')} — ${q.title}?`), ctx.quizId));
    }
    return ok(rule.run({ actor, role, quizzes, quiz: named }));
  }
  return ok(reply('Sorry, I didn’t understand that. I can help with quiz times, attempts, pass marks, scores, ranks and how Tickmark works. Try one of these:', STARTERS[role], named?.id || ctx.quizId));
});

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { createQuiz, getQuiz, updateQuiz } from '../../services/quizzes.js';
import { listCategories } from '../../services/categories.js';
import { navigate } from '../../router.js';
import { toLocalInput } from '../../utils/format.js';
import { Button, ErrorState, Field, Notice, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import QuizQuestionsPanel from './QuizQuestionsPanel.jsx';

const EMPTY = { title: '', subjectId: '', timeLimit: '', passingPercentage: '', maxAttempts: '1', unansweredPenalty: '0', shuffleQuestions: false, shuffleOptions: false, startTime: '', endTime: '' };

const fromQuiz = (q) => ({
  title: q.title, subjectId: q.subjectId, timeLimit: String(q.timeLimit), passingPercentage: String(q.passingPercentage),
  maxAttempts: q.maxAttempts == null ? 'unlimited' : String(q.maxAttempts), unansweredPenalty: String(q.unansweredPenalty || 0),
  shuffleQuestions: !!q.shuffleQuestions, shuffleOptions: !!q.shuffleOptions, startTime: toLocalInput(q.startTime), endTime: toLocalInput(q.endTime),
});

function QuizForm({ quiz, categories, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(quiz ? fromQuiz(quiz) : EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  const submit = (e) => {
    e.preventDefault();
    const r = quiz ? updateQuiz(user, quiz.id, form) : createQuiz(user, form);
    if (!r.ok) {                                   // the form keeps everything the teacher typed
      setErrors(r.errors || {});
      setFormError(Object.keys(r.errors || {}).length ? r.error : r.error);
      return;
    }
    setErrors({}); setFormError('');
    toast(quiz ? 'Quiz saved' : 'Quiz created — now add questions');
    onSaved(r.data);
  };

  return (
    <form onSubmit={submit} noValidate>
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="sheet">
        <h2>Details</h2>
        <div className="grid-2">
          <Field id="q-title" label="Title" error={errors.title}><input id="q-title" type="text" value={form.title} onChange={set('title')} aria-invalid={!!errors.title} /></Field>
          <Field id="q-subject" label="Subject" error={errors.subjectId}>
            <select id="q-subject" value={form.subjectId} onChange={set('subjectId')} aria-invalid={!!errors.subjectId}>
              <option value="">Choose a subject…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid-3">
          <Field id="q-time" label="Time limit (minutes)" error={errors.timeLimit}><input id="q-time" type="text" inputMode="numeric" value={form.timeLimit} onChange={set('timeLimit')} aria-invalid={!!errors.timeLimit} /></Field>
          <Field id="q-pass" label="Passing percentage" error={errors.passingPercentage} hint="Between 0 and 100."><input id="q-pass" type="text" inputMode="numeric" value={form.passingPercentage} onChange={set('passingPercentage')} aria-invalid={!!errors.passingPercentage} /></Field>
          <Field id="q-att" label="Attempts allowed" error={errors.maxAttempts}>
            <select id="q-att" value={form.maxAttempts} onChange={set('maxAttempts')}>
              <option value="1">Single attempt</option><option value="2">2 attempts</option><option value="3">3 attempts</option><option value="5">5 attempts</option><option value="unlimited">Unlimited</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="sheet">
        <h2>Availability window</h2>
        <p className="muted">Students can only open the quiz between these times. Set both, or leave both empty to keep the quiz unscheduled.</p>
        <div className="grid-2">
          <Field id="q-start" label="Opens" error={errors.startTime}><input id="q-start" type="datetime-local" value={form.startTime} onChange={set('startTime')} aria-invalid={!!errors.startTime} /></Field>
          <Field id="q-end" label="Closes" error={errors.endTime}><input id="q-end" type="datetime-local" value={form.endTime} onChange={set('endTime')} aria-invalid={!!errors.endTime} /></Field>
        </div>
      </div>

      <div className="sheet">
        <h2>Scoring and order</h2>
        <div className="grid-2">
          <div>
            <label className="check"><input type="checkbox" checked={form.shuffleQuestions} onChange={set('shuffleQuestions')} /><span>Shuffle question order<small>Each attempt gets a different order.</small></span></label>
            <label className="check"><input type="checkbox" checked={form.shuffleOptions} onChange={set('shuffleOptions')} /><span>Shuffle multiple-choice options<small>Scoring still follows the correct answer, not its position.</small></span></label>
          </div>
          <Field id="q-pen" label="Unanswered questions" error={errors.unansweredPenalty}>
            <select id="q-pen" value={form.unansweredPenalty} onChange={set('unansweredPenalty')}>
              <option value="0">Score 0 — no penalty</option><option value="0.25">Deduct 0.25 mark each</option><option value="0.5">Deduct 0.5 mark each</option><option value="1">Deduct 1 mark each</option>
            </select>
          </Field>
        </div>
      </div>
      <div className="page-actions">
        <Button type="submit">{quiz ? 'Save changes' : 'Create quiz'}</Button>
        <Button variant="ghost" onClick={() => navigate('/manage')}>Back to quizzes</Button>
      </div>
    </form>
  );
}

/** FR1 / FR10 – create or edit one quiz, its schedule, and its questions. */
export default function QuizEditor({ quizId }) {
  const { user } = useAuth();
  const [cats] = useService(() => listCategories(user), [user.id]);
  const [data, reload] = useService(() => (quizId ? getQuiz(user, quizId) : null), [user.id, quizId]);

  if (!cats.ok) return <ErrorState message={cats.error} onRetry={reload} />;
  if (quizId && !data.ok) return <ErrorState message={data.error} onRetry={reload} />;
  const quiz = quizId ? data.data.quiz : null;

  return (
    <>
      <PageHeader title={quiz ? quiz.title : 'Create quiz'} subtitle={quiz ? 'Edit the settings, schedule and questions.' : 'Set the basics now. You’ll add questions right after.'} />
      <QuizForm key={quiz?.id || 'new'} quiz={quiz} categories={cats.data} onSaved={(q) => { if (!quizId) navigate(`/manage/${q.id}`); else reload(); }} />
      {quiz ? <QuizQuestionsPanel quiz={quiz} questions={data.data.questions} categories={cats.data} onChanged={reload} />
        : <div className="sheet muted" style={{ marginTop: 24 }}>Save the quiz to add or import questions.</div>}
    </>
  );
}

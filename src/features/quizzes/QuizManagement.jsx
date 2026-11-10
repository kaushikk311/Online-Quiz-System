import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { deleteQuiz, listQuizzes } from '../../services/quizzes.js';
import { listCategories } from '../../services/categories.js';
import { navigate } from '../../router.js';
import { formatDateTime } from '../../utils/format.js';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

const STATE_TONE = { open: 'open', upcoming: 'upcoming', closed: 'closed', unscheduled: 'warn', empty: 'warn' };
const STATE_LABEL = { open: 'Open', upcoming: 'Scheduled', closed: 'Closed', unscheduled: 'Not scheduled', empty: 'No questions' };

/** FR1 / FR10 / FR11 – quiz list with create, edit, delete and subject filter. */
export default function QuizManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [res, reload] = useService(() => listQuizzes(user, { categoryId }), [user.id, categoryId]);
  const [cats] = useService(() => listCategories(user), [user.id]);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');

  const remove = () => {
    const r = deleteQuiz(user, confirm.id);
    if (!r.ok) { setError(r.error); return; }
    toast('Quiz deleted'); setConfirm(null); setError(''); reload();
  };

  return (
    <>
      <PageHeader title="Quizzes" subtitle="Create quizzes, set their schedule and manage their questions." actions={<Button onClick={() => navigate('/manage/new')}>Create quiz</Button>} />
      <div className="toolbar">
        <Field id="f-cat" label="Subject">
          <select id="f-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All subjects</option>
            {cats.ok && cats.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
      {!res.ok ? <ErrorState message={res.error} onRetry={reload} /> : res.data.length === 0 ? (
        categoryId ? <EmptyState title="No quizzes match this subject" action={<Button variant="secondary" onClick={() => setCategoryId('')}>Show all subjects</Button>}>Try another subject, or create a quiz for this one.</EmptyState>
          : <EmptyState title="No quizzes yet" action={<Button onClick={() => navigate('/manage/new')}>Create your first quiz</Button>}>Quizzes you create will appear here.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quiz</th><th>Time</th><th>Pass mark</th><th>Questions</th><th>Availability</th><th /></tr></thead>
            <tbody>
              {res.data.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.title}</strong><span className="sub">{q.subjectName} · {q.maxAttempts == null ? 'Unlimited attempts' : q.maxAttempts === 1 ? 'Single attempt' : `${q.maxAttempts} attempts`}</span></td>
                  <td className="nowrap">{q.timeLimit} min</td><td>{q.passingPercentage}%</td><td>{q.questionCount}</td>
                  <td><Badge tone={STATE_TONE[q.availability.state]}>{STATE_LABEL[q.availability.state]}</Badge>
                    {q.startTime && <span className="sub">{formatDateTime(q.startTime)} → {formatDateTime(q.endTime)}</span>}</td>
                  <td className="actions">
                    <Button variant="secondary" small onClick={() => navigate(`/manage/${q.id}`)}>Edit</Button>
                    <Button variant="ghost" small onClick={() => { setConfirm(q); setError(''); }}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirm && <ConfirmDialog title={`Delete “${confirm.title}”?`} message="The quiz and its ratings are removed. Students keep their past results in their history." confirmLabel="Delete quiz" tone="danger" error={error} onConfirm={remove} onCancel={() => setConfirm(null)} />}
    </>
  );
}

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { deleteQuestion, listQuestions, QUESTION_TYPES } from '../../services/questions.js';
import { listCategories } from '../../services/categories.js';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { navigate } from '../../router.js';
import QuestionForm from './QuestionForm.jsx';

/** FR2 / FR11 – the shared question bank with filters. */
export default function QuestionBank() {
  const { user } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ categoryId: '', type: '', search: '' });
  const [res, reload] = useService(() => listQuestions(user, filters), [user.id, filters.categoryId, filters.type, filters.search]);
  const [cats] = useService(() => listCategories(user), [user.id]);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const filtered = filters.categoryId || filters.type || filters.search;

  const remove = () => {
    const r = deleteQuestion(user, confirm.id);
    if (!r.ok) { setError(r.error); return; }
    toast('Question deleted'); setConfirm(null); setError(''); reload();
  };

  return (
    <>
      <PageHeader title="Question bank" subtitle="Write questions once, reuse them in any quiz." actions={<><Button variant="secondary" onClick={() => navigate('/questions/generate')}>Generate from book</Button><Button onClick={() => setForm({})}>Add question</Button></>} />
      <div className="toolbar">
        <Field id="qb-search" label="Search"><input id="qb-search" type="search" placeholder="Search question text" value={filters.search} onChange={set('search')} /></Field>
        <Field id="qb-cat" label="Subject"><select id="qb-cat" value={filters.categoryId} onChange={set('categoryId')}><option value="">All subjects</option>{cats.ok && cats.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field id="qb-type" label="Type"><select id="qb-type" value={filters.type} onChange={set('type')}><option value="">All types</option>{Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      {!res.ok ? <ErrorState message={res.error} onRetry={reload} /> : res.data.length === 0 ? (
        filtered ? <EmptyState title="No questions match these filters" action={<Button variant="secondary" onClick={() => setFilters({ categoryId: '', type: '', search: '' })}>Clear filters</Button>}>Try a different subject, type or search.</EmptyState>
          : <EmptyState title="The question bank is empty" action={<Button onClick={() => setForm({})}>Add the first question</Button>}>Questions you add here can be imported into any quiz.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Question</th><th>Type</th><th>Subject</th><th>In quizzes</th><th /></tr></thead>
            <tbody>{res.data.map((q) => (
              <tr key={q.id}>
                <td style={{ maxWidth: 420 }}>{q.text}</td><td><Badge>{QUESTION_TYPES[q.type]}</Badge></td><td>{q.categoryName || <span className="muted">—</span>}</td><td>{q.usedIn}</td>
                <td className="actions"><Button variant="secondary" small onClick={() => setForm(q)}>Edit</Button><Button variant="ghost" small onClick={() => { setConfirm(q); setError(''); }}>Delete</Button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {form && cats.ok && <QuestionForm question={form.id ? form : null} categories={cats.data} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      {confirm && <ConfirmDialog title="Delete this question?" message={confirm.usedIn ? `It will also be removed from ${confirm.usedIn} quiz${confirm.usedIn > 1 ? 'zes' : ''}. Past attempts keep their own copy.` : 'This can’t be undone.'} confirmLabel="Delete question" tone="danger" error={error} onConfirm={remove} onCancel={() => setConfirm(null)} />}
    </>
  );
}

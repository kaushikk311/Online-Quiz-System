import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { listQuestions, QUESTION_TYPES } from '../../services/questions.js';
import { importQuestions } from '../../services/quizzes.js';
import { Badge, Button, EmptyState, ErrorState, Field, Modal, Notice } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

/** TC05 – choose questions from the bank and add them to the quiz. */
export default function ImportQuestionsDialog({ quiz, categories, onClose, onImported }) {
  const { user } = useAuth();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [res, reload] = useService(() => listQuestions(user, { categoryId }), [user.id, categoryId]);
  const available = res.ok ? res.data.filter((q) => !quiz.questionIds.includes(q.id)) : [];

  const toggle = (id) => { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); setError(''); };
  const confirm = () => {
    const r = importQuestions(user, quiz.id, picked);
    if (!r.ok) { setError(r.error); return; }
    toast(`${r.data.added} question${r.data.added > 1 ? 's' : ''} added to the quiz`); onImported();
  };

  return (
    <Modal title="Import from question bank" wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={confirm}>{picked.length ? `Import ${picked.length} question${picked.length > 1 ? 's' : ''}` : 'Import selected'}</Button></>}>
      <Field id="imp-cat" label="Filter by subject">
        <select id="imp-cat" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPicked([]); }}>
          <option value="">All subjects</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      {!res.ok ? <ErrorState message={res.error} onRetry={reload} /> : available.length === 0 ? (
        <EmptyState title="Nothing to import">{categoryId ? 'No questions in this subject are left to import.' : 'Every question in the bank is already in this quiz.'}</EmptyState>
      ) : available.map((q) => (
        <label className="pick" key={q.id}>
          <input type="checkbox" checked={picked.includes(q.id)} onChange={() => toggle(q.id)} />
          <span><strong>{q.text}</strong><span className="sub muted small" style={{ display: 'block' }}>{QUESTION_TYPES[q.type]}{q.categoryName ? ` · ${q.categoryName}` : ''}</span></span>
        </label>
      ))}
    </Modal>
  );
}

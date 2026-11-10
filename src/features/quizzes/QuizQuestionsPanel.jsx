import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { removeQuestionFromQuiz } from '../../services/quizzes.js';
import { QUESTION_TYPES } from '../../services/questions.js';
import { Badge, Button, EmptyState } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import QuestionForm from '../questions/QuestionForm.jsx';
import ImportQuestionsDialog from './ImportQuestionsDialog.jsx';

/** Questions inside one quiz: add new (UC02), import from the bank (UC01 step 5), edit, remove. */
export default function QuizQuestionsPanel({ quiz, questions, categories, onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(null);       // null | {} (new) | question (edit)
  const [importing, setImporting] = useState(false);

  const remove = (q) => {
    const r = removeQuestionFromQuiz(user, quiz.id, q.id);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Removed from this quiz'); onChanged();
  };

  return (
    <div className="sheet" style={{ marginTop: 24 }}>
      <div className="section-head">
        <h2>Questions ({questions.length})</h2>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => setImporting(true)}>Import from question bank</Button>
          <Button onClick={() => setForm({})}>Add question</Button>
        </div>
      </div>
      {questions.length === 0 ? (
        <EmptyState title="No questions yet">Add a new question, or import ready-made ones from the question bank. Students can’t start a quiz with no questions.</EmptyState>
      ) : (
        <div className="qlist">
          {questions.map((q, i) => (
            <div className="qitem" key={q.id}>
              <span className="bubble" aria-hidden="true">{i + 1}</span>
              <div className="grow"><strong>{q.text}</strong><span className="sub muted small" style={{ display: 'block' }}>{QUESTION_TYPES[q.type]}{q.categoryName ? ` · ${q.categoryName}` : ''}</span></div>
              <Button variant="secondary" small onClick={() => setForm(q)}>Edit</Button>
              <Button variant="ghost" small onClick={() => remove(q)}>Remove</Button>
            </div>
          ))}
        </div>
      )}
      {form && <QuestionForm question={form.id ? form : null} quizId={quiz.id} categories={categories} onClose={() => setForm(null)} onSaved={() => { setForm(null); onChanged(); }} />}
      {importing && <ImportQuestionsDialog quiz={quiz} categories={categories} onClose={() => setImporting(false)} onImported={() => { setImporting(false); onChanged(); }} />}
    </div>
  );
}

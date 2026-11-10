import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { saveQuestion, QUESTION_TYPES } from '../../services/questions.js';
import { uid } from '../../services/clock.js';
import { letter } from '../../utils/format.js';
import { Button, Field, Modal, Notice } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

const newOptions = () => ['', '', '', ''].map(() => ({ id: uid('o'), text: '' }));

/** FR2 / UC02 – create or edit an MCQ, True/False or Fill-in-the-Blank question. Pass quizId to add it to a quiz. */
export default function QuestionForm({ question, quizId, categories, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const editing = !!question?.id;   // a generated draft has no id yet, so it saves as a new question
  const [f, setF] = useState(() => question ? { ...question, options: question.options ? question.options.map((o) => ({ ...o })) : newOptions(), categoryId: question.categoryId || '' }
    : { type: 'mcq', text: '', options: newOptions(), correct: '', explanation: '', categoryId: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const clear = (k) => setErrors((e) => ({ ...e, [k]: undefined }));
  const setOpt = (id, text) => { setF({ ...f, options: f.options.map((o) => (o.id === id ? { ...o, text } : o)) }); clear('option_' + id); };
  const changeType = (type) => { setF({ ...f, type, correct: '' }); setErrors({}); setFormError(''); };

  const submit = (e) => {
    e.preventDefault();
    const r = saveQuestion(user, f, { quizId });
    if (!r.ok) { setErrors(r.errors || {}); setFormError(r.error); return; }
    toast(editing ? 'Question updated' : quizId ? 'Question added to the quiz' : 'Question saved');
    onSaved(r.data);
  };

  return (
    <Modal title={editing ? 'Edit question' : 'Add question'} wide onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="question-form">Save question</Button></>}>
      <form id="question-form" onSubmit={submit} noValidate>
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="grid-2">
          <Field id="qf-type" label="Question type">
            <select id="qf-type" value={f.type} disabled={editing} onChange={(e) => changeType(e.target.value)}>
              {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field id="qf-cat" label="Subject (optional)" error={errors.categoryId}>
            <select id="qf-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">No subject</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field id="qf-text" label="Question" error={errors.text}>
          <textarea id="qf-text" value={f.text} onChange={(e) => { setF({ ...f, text: e.target.value }); clear('text'); }} aria-invalid={!!errors.text} />
        </Field>

        {f.type === 'mcq' && (
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
            <legend style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 8 }}>Answer options — select the correct one</legend>
            {f.options.map((o, i) => (
              <div className="opt-row" key={o.id}>
                <input type="radio" name="correct" checked={f.correct === o.id} onChange={() => { setF({ ...f, correct: o.id }); clear('correct'); }} aria-label={`Option ${letter(i)} is correct`} />
                <span className="bubble" aria-hidden="true">{letter(i)}</span>
                <Field id={`opt-${o.id}`} error={errors['option_' + o.id]}>
                  <input id={`opt-${o.id}`} type="text" placeholder={`Option ${letter(i)}`} value={o.text} onChange={(e) => setOpt(o.id, e.target.value)} aria-label={`Option ${letter(i)}`} aria-invalid={!!errors['option_' + o.id]} />
                </Field>
                {f.options.length > 2 && <Button variant="ghost" small onClick={() => setF({ ...f, options: f.options.filter((x) => x.id !== o.id), correct: f.correct === o.id ? '' : f.correct })} aria-label={`Remove option ${letter(i)}`}>Remove</Button>}
              </div>
            ))}
            {errors.options && <p className="error-text" role="alert">{errors.options}</p>}
            {errors.correct && <p className="error-text" role="alert">{errors.correct}</p>}
            {f.options.length < 6 && <Button variant="secondary" small onClick={() => setF({ ...f, options: [...f.options, { id: uid('o'), text: '' }] })}>Add option</Button>}
          </fieldset>
        )}
        {f.type === 'tf' && (
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
            <legend style={{ fontWeight: 600, fontSize: '.9rem', marginBottom: 8 }}>Correct answer</legend>
            {['true', 'false'].map((v) => (
              <label className="omr" key={v}><input type="radio" name="tf" checked={f.correct === v} onChange={() => { setF({ ...f, correct: v }); clear('correct'); }} /><span className="bubble">{v === 'true' ? 'T' : 'F'}</span><span>{v === 'true' ? 'True' : 'False'}</span></label>
            ))}
            {errors.correct && <p className="error-text" role="alert">{errors.correct}</p>}
          </fieldset>
        )}
        {f.type === 'fib' && (
          <Field id="qf-correct" label="Correct answer" error={errors.correct} hint="Matching ignores capital letters and extra spaces. Separate accepted alternatives with | (for example: 9|nine).">
            <input id="qf-correct" type="text" value={f.correct} onChange={(e) => { setF({ ...f, correct: e.target.value }); clear('correct'); }} aria-invalid={!!errors.correct} />
          </Field>
        )}
        <Field id="qf-exp" label="Explanation (optional)" hint="Shown to students in their review when they get this question wrong.">
          <textarea id="qf-exp" value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

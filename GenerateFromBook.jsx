import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { generateFromText, saveGeneratedQuestions, splitSections } from '../../services/bookGenerator.js';
import { readBookFile } from '../../services/bookText.js';
import { listCategories } from '../../services/categories.js';
import { listQuizzes } from '../../services/quizzes.js';
import { QUESTION_TYPES } from '../../services/questions.js';
import { navigate } from '../../router.js';
import { letter } from '../../utils/format.js';
import { Badge, Button, EmptyState, Field, Notice, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import QuestionForm from './QuestionForm.jsx';

/** Extra feature – upload or paste book text, generate draft questions, review them, then save the ones you accept. */
export default function GenerateFromBook() {
  const { user } = useAuth();
  const toast = useToast();
  const [cats] = useService(() => listCategories(user), [user.id]);
  const [quizzes] = useService(() => listQuizzes(user), [user.id]);
  const [book, setBook] = useState(null);                       // { title, sections }
  const [pasted, setPasted] = useState('');
  const [range, setRange] = useState({ from: 0, to: 0 });
  const [counts, setCounts] = useState({ mcq: 3, fib: 3, tf: 3 });
  const [categoryId, setCategoryId] = useState('');
  const [quizId, setQuizId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);                   // { drafts, warnings }
  const [picked, setPicked] = useState({});
  const [editing, setEditing] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const b = await readBookFile(file);
      setBook(b); setRange({ from: 0, to: Math.min(b.sections.length - 1, 4) }); setPasted('');
    } catch (err) { setBook(null); setError(err.message); }
    setLoading(false); e.target.value = '';
  };

  const sourceText = () => (pasted.trim() ? pasted : book ? book.sections.slice(range.from, range.to + 1).map((s) => s.text).join('\n\n') : '');
  const sourceTitle = book && !pasted.trim() ? book.title : 'Pasted text';

  const generate = () => {
    setError(''); setResult(null);
    const r = generateFromText(user, { text: sourceText(), counts });
    if (!r.ok) { setError(r.error); return; }
    setResult(r.data);
    setPicked(Object.fromEntries(r.data.drafts.map((d) => [d.draftId, true])));
  };

  const chosen = result ? result.drafts.filter((d) => picked[d.draftId]) : [];
  const save = () => {
    const r = saveGeneratedQuestions(user, chosen, { categoryId, quizId, sourceTitle });
    if (!r.ok) { setError(r.error); return; }                   // drafts stay on screen if saving fails
    toast(`${r.data.saved} question${r.data.saved > 1 ? 's' : ''} saved to the question bank${r.data.skipped ? ` (${r.data.skipped} skipped)` : ''}`);
    const left = result.drafts.filter((d) => !picked[d.draftId]);
    setResult(left.length ? { ...result, drafts: left } : null); setPicked({});
    if (!left.length) navigate(quizId ? `/manage/${quizId}` : '/questions');
  };

  const setCount = (k) => (e) => setCounts({ ...counts, [k]: e.target.value });
  const sections = book?.sections || [];

  return (
    <>
      <PageHeader title="Generate questions from a book" subtitle="Questions are written from the text you provide. Review them before saving — nothing is added until you accept it."
        actions={<Button variant="ghost" onClick={() => navigate('/questions')}>Back to question bank</Button>} />
      {error && <Notice tone="error">{error}</Notice>}

      <div className="sheet">
        <h2>1. Provide the text</h2>
        <div className="grid-2">
          <Field id="bk-file" label="Upload a book or chapter" hint="PDF, TXT or MD, up to 30 MB. Scanned PDFs without selectable text can’t be read.">
            <input id="bk-file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={onFile} />
          </Field>
          <Field id="bk-paste" label="…or paste text" hint="Use at least a few paragraphs. Pasted text is used instead of an uploaded file.">
            <textarea id="bk-paste" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste a chapter or section here" />
          </Field>
        </div>
        {loading && <p className="muted">Reading the file…</p>}
        {book && !pasted.trim() && (
          <>
            <Notice tone="success" title={`Loaded “${book.title}”`}>{sections.length} {sections[0]?.label.startsWith('Page') ? 'pages' : 'sections'} found. Choose the range to use.</Notice>
            {sections.length > 1 && (
              <div className="grid-2">
                <Field id="bk-from" label="From"><select id="bk-from" value={range.from} onChange={(e) => { const from = Number(e.target.value); setRange({ from, to: Math.max(from, range.to) }); }}>{sections.map((s) => <option key={s.index} value={s.index}>{s.label}</option>)}</select></Field>
                <Field id="bk-to" label="To"><select id="bk-to" value={range.to} onChange={(e) => setRange({ ...range, to: Number(e.target.value) })}>{sections.filter((s) => s.index >= range.from).map((s) => <option key={s.index} value={s.index}>{s.label}</option>)}</select></Field>
              </div>
            )}
          </>
        )}
      </div>

      <div className="sheet">
        <h2>2. Choose what to generate</h2>
        <div className="grid-3">
          {Object.entries(QUESTION_TYPES).map(([k, label]) => (
            <Field key={k} id={`bk-${k}`} label={label}><input id={`bk-${k}`} type="number" min="0" max="15" value={counts[k]} onChange={setCount(k)} /></Field>
          ))}
        </div>
        <div className="grid-2">
          <Field id="bk-cat" label="Save under subject (optional)"><select id="bk-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">No subject</option>{cats.ok && cats.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field id="bk-quiz" label="Also add to a quiz (optional)"><select id="bk-quiz" value={quizId} onChange={(e) => setQuizId(e.target.value)}><option value="">Question bank only</option>{quizzes.ok && quizzes.data.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}</select></Field>
        </div>
        <Button onClick={generate} disabled={loading || (!pasted.trim() && !book)}>Generate questions</Button>
      </div>

      {result && (
        <div className="sheet">
          <div className="section-head"><h2>3. Review the drafts ({result.drafts.length})</h2>
            <Button onClick={save} disabled={!chosen.length}>Save {chosen.length} selected</Button></div>
          <Notice tone="warning" title="Automatically generated">Check every question and answer against the book. True/False “false” statements are made by swapping a term, so read them carefully.</Notice>
          {result.warnings.map((w) => <Notice key={w} tone="info">{w}</Notice>)}
          {result.drafts.length === 0 ? <EmptyState title="Nothing left to review" /> : result.drafts.map((d) => (
            <article className="draft" key={d.draftId}>
              <input type="checkbox" checked={!!picked[d.draftId]} onChange={(e) => setPicked({ ...picked, [d.draftId]: e.target.checked })} aria-label="Include this question" />
              <div className="grow">
                <Badge>{QUESTION_TYPES[d.type]}</Badge>
                <p className="qtext-sm">{d.text}</p>
                {d.type === 'mcq' && <ol className="draft-opts">{d.options.map((o, i) => <li key={o.id} className={o.id === d.correct ? 'right' : ''}><span className="bubble">{letter(i)}</span>{o.text}{o.id === d.correct && <Badge tone="pass">correct</Badge>}</li>)}</ol>}
                {d.type === 'tf' && <p className="small"><strong>Answer:</strong> {d.correct === 'true' ? 'True' : 'False'}</p>}
                {d.type === 'fib' && <p className="small"><strong>Answer:</strong> {d.correct}</p>}
                <p className="muted small">{d.explanation}</p>
              </div>
              <div className="draft-actions"><Button variant="secondary" small onClick={() => setEditing(d)}>Edit &amp; save</Button><Button variant="ghost" small onClick={() => setResult({ ...result, drafts: result.drafts.filter((x) => x.draftId !== d.draftId) })}>Discard</Button></div>
            </article>
          ))}
        </div>
      )}
      {editing && cats.ok && <QuestionForm question={{ ...editing, id: undefined, categoryId }} quizId={quizId || undefined} categories={cats.data} onClose={() => setEditing(null)}
        onSaved={() => { setResult({ ...result, drafts: result.drafts.filter((x) => x.draftId !== editing.draftId) }); setEditing(null); }} />}
    </>
  );
}

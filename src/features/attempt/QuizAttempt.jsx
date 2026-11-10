import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { useCountdown } from '../../hooks/useCountdown.js';
import { flushPending, getEligibility, saveAnswer, startAttempt, submitAttempt } from '../../services/attempts.js';
import { isOnline } from '../../services/network.js';
import { navigate } from '../../router.js';
import { formatCountdown, formatDateTime, letter } from '../../utils/format.js';
import { AccessDenied, Button, ConfirmDialog, ErrorState, Notice, PageHeader } from '../../components/ui.jsx';

/** Gate screen (eligibility) → timed runner. Covers UC03, UC05 and UC09 on the student side. */
export default function QuizAttempt({ quizId }) {
  const { user } = useAuth();
  const [gate, reloadGate] = useService(() => getEligibility(user, quizId), [user.id, quizId]);
  const [active, setActive] = useState(null);
  const [startError, setStartError] = useState('');

  if (active) return <Runner key={active.id} initial={active} />;
  if (!gate.ok) {
    return gate.code === 'NOT_FOUND' ? <AccessDenied title="Quiz not found" message={gate.error} backTo="/quizzes" backLabel="Back to quizzes" /> : <ErrorState message={gate.error} onRetry={reloadGate} />;
  }
  const g = gate.data, q = g.quiz;

  const start = () => {
    const r = startAttempt(user, quizId);
    if (!r.ok) { setStartError(r.error); reloadGate(); return; }
    setActive(r.data);
  };

  return (
    <>
      <PageHeader title={q.title} subtitle={q.subjectName} />
      {startError && <Notice tone="error">{startError}</Notice>}
      {!g.canStart && (
        <div className="sheet">
          <Notice tone="warning" title={{ NOT_STARTED: 'This quiz isn’t open yet', ENDED: 'This quiz is closed', ATTEMPTS_EXHAUSTED: 'No attempts left', NOT_SCHEDULED: 'This quiz isn’t scheduled', NO_QUESTIONS: 'This quiz has no questions' }[g.code] || 'You can’t start this quiz'}>{g.reason}</Notice>
          <div className="page-actions"><Button variant="secondary" onClick={() => navigate('/quizzes')}>Back to quizzes</Button>{g.code === 'ATTEMPTS_EXHAUSTED' && <Button variant="ghost" onClick={() => navigate('/history')}>See my attempts</Button>}</div>
        </div>
      )}
      <dl className="facts">
        <div><dt>Questions</dt><dd>{q.questionCount}</dd></div><div><dt>Time limit</dt><dd>{q.timeLimit} min</dd></div><div><dt>Pass mark</dt><dd>{q.passingPercentage}%</dd></div>
        <div><dt>Attempts</dt><dd>{g.attemptsLeft == null ? 'Unlimited' : `${g.attemptsLeft} left`}</dd></div>
      </dl>
      <div className="sheet">
        <h2>Before you begin</h2>
        <ul>
          <li>The timer starts as soon as you press start and keeps running if you leave the page.</li>
          <li>Your answers are saved as you go. If time runs out, the quiz is submitted for you.</li>
          <li>The quiz is available {formatDateTime(q.startTime)} to {formatDateTime(q.endTime)}.</li>
        </ul>
        {g.canStart && <Button onClick={start}>{g.inProgressId ? 'Resume quiz' : 'Start quiz'}</Button>}
      </div>
    </>
  );
}

function Runner({ initial }) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState(initial.answers || {});
  const [idx, setIdx] = useState(0);
  const [ended, setEnded] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [saveWarn, setSaveWarn] = useState('');
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(!!initial.pendingSubmit);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const left = useCountdown(initial.deadline);
  const expired = left <= 0;
  const locked = ended || expired || pending;
  const qs = initial.questions;
  const q = qs[idx];
  const goResult = () => navigate(`/result/${initial.id}`);

  // FR5 / UC05: when the timer reaches zero the session is terminated and the attempt auto-submitted.
  useEffect(() => {
    if (!expired) return undefined;
    setEnded(true);
    let timer;
    const go = () => {
      const r = submitAttempt(user, initial.id, { reason: 'timeout', answers: answersRef.current });
      if (r.ok || !['SAVE_FAILED', 'LOAD_FAILED'].includes(r.code)) timer = setTimeout(goResult, 1800);
      else timer = setTimeout(go, 1500);                                   // storage hiccup: keep retrying
    };
    go();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  // NFR3: track the network; queued submissions are sent when the connection returns.
  useEffect(() => {
    const on = () => {
      setOnline(true);
      const r = flushPending(user);
      if (r.ok && r.data.attemptIds.includes(initial.id)) goResult();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (value) => {
    if (locked) return;
    setAnswers((a) => ({ ...a, [q.id]: value }));
    const r = saveAnswer(user, initial.id, q.id, value);
    if (r.ok) setSaveWarn('');
    else if (r.code === 'SESSION_ENDED') { setEnded(true); setTimeout(goResult, 1800); }
    else setSaveWarn(r.error);                                              // answer stays on screen and is sent with the submission
  };

  const submit = () => {
    const r = submitAttempt(user, initial.id, { reason: 'manual', answers });
    if (r.ok) { goResult(); return; }
    if (r.code === 'OFFLINE') { setPending(true); setConfirm(false); return; }
    setSubmitError(r.error);                                                 // nothing lost: the dialog stays open for a retry
  };

  const answered = qs.filter((x) => answers[x.id] != null && String(answers[x.id]).trim() !== '').length;
  const total = initial.deadline - initial.startedAt;
  const tone = left < 30000 ? 'crit' : left < 60000 ? 'low' : '';

  return (
    <>
      <div className="runner-bar" style={{ position: 'sticky' }}>
        <h2>{initial.quizTitle}</h2>
        <span className="small" style={{ color: '#c5cbe6' }}>{answered} of {qs.length} answered</span>
        <span className={`timer ${tone}`} role="timer" aria-label="Time remaining">{formatCountdown(left)}</span>
        <Button variant="marker" onClick={() => { setSubmitError(''); setConfirm(true); }} disabled={locked}>Submit quiz</Button>
        <div className="timebar"><i style={{ width: `${Math.max(0, Math.min(100, (left / total) * 100))}%` }} /></div>
      </div>
      {!online && !pending && <Notice tone="warning" title="You’re offline">Keep going — your answers are saved on this device. Submit when you’re back online.</Notice>}
      {pending && <Notice tone="warning" title="Submission queued">You’re offline. Your answers are safe and will be submitted automatically as soon as you reconnect.</Notice>}
      {saveWarn && <Notice tone="error" title="Last answer not saved">{saveWarn} It’s still on screen and will be included when you submit.</Notice>}

      <div className="runner">
        <section className="qpanel" aria-live="off">
          <p className="qnum">Question {idx + 1} of {qs.length}</p>
          <h2 className="qtext">{q.text}</h2>
          {q.type === 'mcq' && <div role="radiogroup" aria-label="Answer options">{q.options.map((o, i) => (
            <label key={o.id} className={`omr${locked ? ' locked' : ''}`}><input type="radio" name={`q-${q.id}`} checked={answers[q.id] === o.id} disabled={locked} onChange={() => answer(o.id)} /><span className="bubble">{letter(i)}</span><span>{o.text}</span></label>
          ))}</div>}
          {q.type === 'tf' && <div role="radiogroup" aria-label="True or false">{['true', 'false'].map((v) => (
            <label key={v} className={`omr${locked ? ' locked' : ''}`}><input type="radio" name={`q-${q.id}`} checked={answers[q.id] === v} disabled={locked} onChange={() => answer(v)} /><span className="bubble">{v === 'true' ? 'T' : 'F'}</span><span>{v === 'true' ? 'True' : 'False'}</span></label>
          ))}</div>}
          {q.type === 'fib' && <input type="text" aria-label="Your answer" placeholder="Type your answer" value={answers[q.id] || ''} disabled={locked} onChange={(e) => answer(e.target.value)} autoComplete="off" />}
          {answers[q.id] != null && !locked && <p className="hint">Answer saved. <button className="link-btn" onClick={() => answer('')}>Clear answer</button></p>}
          <div className="qnav">
            <Button variant="secondary" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>Previous</Button>
            {idx < qs.length - 1 ? <Button onClick={() => setIdx(idx + 1)}>Next</Button> : <Button variant="marker" onClick={() => { setSubmitError(''); setConfirm(true); }} disabled={locked}>Review and submit</Button>}
          </div>
        </section>
        <aside className="palette-wrap" aria-label="Question palette">
          <h4>Questions</h4>
          <div className="palette">{qs.map((x, i) => <button key={x.id} className={`pbtn${answers[x.id] != null && String(answers[x.id]).trim() !== '' ? ' done' : ''}${i === idx ? ' current' : ''}`} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}${answers[x.id] != null ? ', answered' : ''}`}>{i + 1}</button>)}</div>
          <div className="legend"><span><span className="bubble" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle', background: 'var(--marker)' }} /> Answered</span><span><span className="bubble" style={{ width: 14, height: 14, display: 'inline-block', verticalAlign: 'middle' }} /> Not answered</span></div>
        </aside>
      </div>

      {confirm && !ended && (
        <ConfirmDialog title="Submit your quiz?" confirmLabel="Submit now" error={submitError} onConfirm={submit} onCancel={() => setConfirm(false)}
          message={<><p>You’ve answered <strong>{answered}</strong> of <strong>{qs.length}</strong> questions.</p>{answered < qs.length && <p className="muted">Unanswered questions will be scored according to the quiz rules.</p>}<p className="muted">You can’t change answers after submitting.</p></>} />
      )}
      {ended && <div className="timeup" role="alert"><h2>Time’s up</h2><p>Your answers have been submitted automatically. Taking you to your result…</p></div>}
    </>
  );
}

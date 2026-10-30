import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Timer from '../components/Timer.jsx';

const toList = (map) => Object.entries(map).map(([questionId, answer]) => ({
  questionId: Number(questionId), answer
}));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function ReliableAttempt() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const backupKey = `attempt_${attemptId}_answers`;

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Loading...');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const answersRef = useRef({});
  const dirtyRef = useRef(false);
  const submittedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => {
      setIsOnline(false);
      setSaveStatus('Offline - answers are stored in this browser');
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api(`/attempts/${attemptId}`);
        if (cancelled) return;
        if (data.status === 'SUBMITTED') {
          navigate(`/result/${attemptId}`, { replace: true });
          return;
        }
        let backup = {};
        try { backup = JSON.parse(localStorage.getItem(backupKey) || '{}'); }
        catch { backup = {}; }
        const merged = { ...(data.savedAnswers || {}), ...backup };
        answersRef.current = merged;
        dirtyRef.current = Object.keys(backup).length > 0;
        setAnswers(merged);
        setQuiz(data);
        setTimeLeft(data.timeLeftSeconds);
        setSaveStatus(dirtyRef.current ? 'Recovered local answers - saving...' : 'Answers loaded');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load this quiz attempt.');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [attemptId, backupKey, navigate]);

  async function saveAnswers() {
    if (!dirtyRef.current || submittedRef.current || savingRef.current) return;
    if (!navigator.onLine) {
      setSaveStatus('Offline - answers are stored in this browser');
      return;
    }
    const snapshot = answersRef.current;
    savingRef.current = true;
    dirtyRef.current = false;
    setSaveStatus('Saving answers...');
    try {
      await api(`/attempts/${attemptId}/answers`, 'PUT', { answers: toList(snapshot) });
      if (answersRef.current === snapshot) setSaveStatus('All answers saved');
      else {
        dirtyRef.current = true;
        setSaveStatus('New changes waiting to save');
      }
    } catch (err) {
      dirtyRef.current = true;
      setSaveStatus(err.status && err.status < 500
        ? (err.message || 'Answer update rejected')
        : 'Save failed - will retry automatically');
    } finally {
      savingRef.current = false;
    }
  }

  useEffect(() => {
    if (!quiz) return;
    const id = setInterval(saveAnswers, 8000);
    return () => clearInterval(id);
  }, [quiz, answers]);

  useEffect(() => {
    if (!quiz) return;
    const endAt = Date.now() + Number(quiz.timeLeftSeconds || 0) * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(id);
        submitAttempt(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [quiz]);

  function updateAnswer(questionId, value) {
    const updated = { ...answersRef.current, [questionId]: value };
    answersRef.current = updated;
    dirtyRef.current = true;
    setAnswers(updated);
    setSaveStatus('Unsaved changes');
    try { localStorage.setItem(backupKey, JSON.stringify(updated)); }
    catch { setSaveStatus('Browser storage unavailable - server autosave will be used'); }
  }

  async function submitAttempt(auto = false) {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    setConfirming(false);
    setError('');
    const payload = { answers: toList(answersRef.current), auto };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await api(`/attempts/${attemptId}/submit`, 'POST', payload);
        try { localStorage.removeItem(backupKey); } catch {}
        navigate(`/result/${attemptId}`, { replace: true });
        return;
      } catch (err) {
        if (err.status && err.status < 500) {
          setError(err.message || 'The server rejected this submission.');
          submittedRef.current = false;
          setSubmitting(false);
          return;
        }
        if (attempt < 3) await wait(1500 * attempt);
      }
    }
    submittedRef.current = false;
    setSubmitting(false);
    setError(auto
      ? 'Time is over, but the server could not be reached. Your local answers are preserved. Reconnect and submit.'
      : 'Submission failed because of a network problem. Your answers are preserved; please try again.');
  }

  if (error && !quiz) return <p className="error">{error}</p>;
  if (!quiz) return <p>Loading quiz...</p>;

  const answered = quiz.questions.filter((q) =>
    answers[q.id] !== undefined && answers[q.id] !== ''
  ).length;

  return (
    <div className="reliable-attempt">
      <div className="quiz-header">
        <h2>{quiz.title}</h2>
        <Timer seconds={timeLeft} />
      </div>

      <p className="muted">
        {isOnline ? '● Connected' : '● Offline'} | Answered {answered} of {quiz.questions.length} | {saveStatus}
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      {quiz.questions.map((q, index) => (
        <div className="card question" key={q.id}>
          <p className="question-text">
            <b>Q{index + 1}.</b> {q.question_text}
            <span className="marks">({q.marks} {q.marks === 1 ? 'mark' : 'marks'})</span>
          </p>

          {q.question_type === 'MCQ' && (q.options || []).map((opt) => (
            <label className="option" key={opt}>
              <input type="radio" name={`q_${q.id}`} checked={answers[q.id] === opt}
                disabled={submitting} onChange={() => updateAnswer(q.id, opt)} />
              {opt}
            </label>
          ))}

          {q.question_type === 'TRUE_FALSE' && ['True', 'False'].map((opt) => (
            <label className="option" key={opt}>
              <input type="radio" name={`q_${q.id}`} checked={answers[q.id] === opt}
                disabled={submitting} onChange={() => updateAnswer(q.id, opt)} />
              {opt}
            </label>
          ))}

          {q.question_type === 'FILL_BLANK' && (
            <input type="text" maxLength={500} placeholder="Type your answer"
              value={answers[q.id] || ''} disabled={submitting}
              onChange={(e) => updateAnswer(q.id, e.target.value)} />
          )}
        </div>
      ))}

      <div className="submit-area">
        {submitting ? <p>Submitting...</p> : confirming ? (
          <div className="confirm-box">
            <p>You answered {answered} of {quiz.questions.length} questions. You cannot change answers after submitting. Submit now?</p>
            <button className="btn" onClick={() => submitAttempt(false)}>Yes, submit</button>
            <button className="btn btn-light" onClick={() => setConfirming(false)}>Go back</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirming(true)}>Submit Quiz</button>
        )}
      </div>
    </div>
  );
}

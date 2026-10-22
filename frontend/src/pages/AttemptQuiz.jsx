import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Timer from '../components/Timer.jsx';

// converts { questionId: answer } to the list format the backend wants
function toList(answerMap) {
  return Object.keys(answerMap).map((id) => ({ questionId: Number(id), answer: answerMap[id] }));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function AttemptQuiz() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const backupKey = 'attempt_' + attemptId + '_answers';

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // refs are used inside the timers so they always have the latest values
  const answersRef = useRef({});
  const unsavedRef = useRef(false); // true when some answers are not sent to server yet
  const submittedRef = useRef(false);

  // load the questions and any answers saved before
  useEffect(() => {
    api('/attempts/' + attemptId)
      .then((data) => {
        if (data.status === 'SUBMITTED') {
          navigate('/result/' + attemptId, { replace: true });
          return;
        }

        // backup in browser is used if the last autosave did not reach the server
        let backup = {};
        try {
          backup = JSON.parse(localStorage.getItem(backupKey)) || {};
        } catch (e) {
          backup = {};
        }
        if (Object.keys(backup).length > 0) {
          unsavedRef.current = true;
        }

        const merged = { ...data.savedAnswers, ...backup };
        answersRef.current = merged;
        setAnswers(merged);
        setQuiz(data);
        setTimeLeft(data.timeLeftSeconds);
      })
      .catch((err) => setError(err.status ? err.message : 'Cannot connect to server'));
  }, [attemptId]);

  // countdown timer. when it reaches 0 the quiz is submitted automatically (#9)
  // time is worked out from the end time so it stays correct even if the tab was in background
  useEffect(() => {
    if (!quiz) return;

    const endsAt = Date.now() + quiz.timeLeftSeconds * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(timer);
        submitQuiz(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz]);

  // autosave every 10 seconds if something changed (#19)
  useEffect(() => {
    if (!quiz) return;
    const saver = setInterval(saveToServer, 10000);
    return () => clearInterval(saver);
  }, [quiz]);

  async function saveToServer() {
    if (!unsavedRef.current || submittedRef.current) return;

    unsavedRef.current = false;
    setSaveStatus('Saving...');
    try {
      await api('/attempts/' + attemptId + '/answers', 'PUT', { answers: toList(answersRef.current) });
      setSaveStatus('All answers saved');
    } catch (err) {
      if (err.status) {
        setSaveStatus(err.message);
      } else {
        unsavedRef.current = true; // try again in the next round
        setSaveStatus('Could not save (no internet?) - will try again');
      }
    }
  }

  function handleChange(questionId, value) {
    const updated = { ...answersRef.current, [questionId]: value };
    answersRef.current = updated;
    setAnswers(updated);
    unsavedRef.current = true;
    setSaveStatus('Not saved yet');

    // keep a copy in the browser also
    try {
      localStorage.setItem(backupKey, JSON.stringify(updated));
    } catch (e) {
      // storage full or blocked, autosave will still work
    }
  }

  // auto = true when the timer ran out
  // if internet fails we try 3 times. the server ignores duplicate submits so retry is safe (#19)
  async function submitQuiz(auto) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setConfirming(false);
    setError('');

    const list = toList(answersRef.current);

    for (let tryNo = 1; tryNo <= 3; tryNo++) {
      try {
        await api('/attempts/' + attemptId + '/submit', 'POST', { answers: list, auto });
        localStorage.removeItem(backupKey);
        navigate('/result/' + attemptId, { replace: true });
        return;
      } catch (err) {
        if (err.status) {
          // server replied with an error, no point retrying
          setError(err.message);
          submittedRef.current = false;
          setSubmitting(false);
          return;
        }
        await wait(2000);
      }
    }

    submittedRef.current = false;
    setSubmitting(false);
    setError(
      auto
        ? 'Time is over but we could not reach the server. Your saved answers will be submitted automatically.'
        : 'Could not submit because of a network problem. Your answers are kept, please try again.'
    );
  }

  if (error && !quiz) {
    return <p className="error">{error}</p>;
  }
  if (!quiz) {
    return <p>Loading quiz...</p>;
  }

  const answeredCount = quiz.questions.filter((q) => answers[q.id]).length;

  return (
    <div>
      <div className="quiz-header">
        <h2>{quiz.title}</h2>
        <Timer seconds={timeLeft} />
      </div>

      <p className="muted">
        Answered {answeredCount} of {quiz.questions.length} &nbsp;|&nbsp; {saveStatus}
      </p>

      {error && <p className="error">{error}</p>}

      {quiz.questions.map((q, index) => (
        <div className="card question" key={q.id}>
          <p className="question-text">
            <b>Q{index + 1}.</b> {q.question_text}
            <span className="marks">({q.marks} {q.marks === 1 ? 'mark' : 'marks'})</span>
          </p>

          {q.question_type === 'MCQ' && q.options.map((opt) => (
            <label className="option" key={opt}>
              <input
                type="radio"
                name={'q_' + q.id}
                checked={answers[q.id] === opt}
                disabled={submitting}
                onChange={() => handleChange(q.id, opt)}
              />
              {opt}
            </label>
          ))}

          {q.question_type === 'TRUE_FALSE' && ['True', 'False'].map((opt) => (
            <label className="option" key={opt}>
              <input
                type="radio"
                name={'q_' + q.id}
                checked={answers[q.id] === opt}
                disabled={submitting}
                onChange={() => handleChange(q.id, opt)}
              />
              {opt}
            </label>
          ))}

          {q.question_type === 'FILL_BLANK' && (
            <input
              type="text"
              placeholder="Type your answer"
              maxLength={500}
              value={answers[q.id] || ''}
              disabled={submitting}
              onChange={(e) => handleChange(q.id, e.target.value)}
            />
          )}
        </div>
      ))}

      <div className="submit-area">
        {submitting ? (
          <p>Submitting...</p>
        ) : confirming ? (
          <div className="confirm-box">
            <p>
              You answered {answeredCount} of {quiz.questions.length} questions.
              You cannot change answers after submitting. Submit now?
            </p>
            <button className="btn" onClick={() => submitQuiz(false)}>Yes, submit</button>
            <button className="btn btn-light" onClick={() => setConfirming(false)}>No, go back</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirming(true)}>Submit Quiz</button>
        )}
      </div>
    </div>
  );
}

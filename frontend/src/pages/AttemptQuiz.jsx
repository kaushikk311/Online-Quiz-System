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
  const leftPageRef = useRef(false); // true after the student goes to some other page

  useEffect(() => {
    leftPageRef.current = false;
    return () => {
      leftPageRef.current = true;
    };
  }, []);

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

  // ask before closing or refreshing the tab while the quiz is not submitted (#9)
  // the answers are kept, but the timer keeps going on the server
  useEffect(() => {
    if (!quiz) return;

    function warnBeforeLeaving(e) {
      if (!submittedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [quiz]);

  // autosave every 10 seconds if something changed (#19)
  // the first save waits a random time (0-10 sec) so a class that started together
  // does not send all the autosaves in the same second (#18)
  useEffect(() => {
    if (!quiz) return;
    let saver = null;
    const firstSave = setTimeout(() => {
      saveToServer();
      saver = setInterval(saveToServer, 10000);
    }, Math.random() * 10000);

    return () => {
      clearTimeout(firstSave);
      clearInterval(saver);
    };
  }, [quiz]);

  async function saveToServer() {
    if (!unsavedRef.current || submittedRef.current) return;

    unsavedRef.current = false;
    setSaveStatus('Saving...');
    try {
      await api('/attempts/' + attemptId + '/answers', 'PUT', { answers: toList(answersRef.current) });
      setSaveStatus('All answers saved');
    } catch (err) {
      if (err.status && err.status < 500) {
        setSaveStatus(err.message);
      } else {
        // no internet, or server too busy (5xx) -> try again in the next round
        unsavedRef.current = true;
        setSaveStatus('Could not save right now - will try again');
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
  // when time is over we keep trying until it goes through, since the answers cannot be
  // changed any more. if the server job submits it first, the retry just gets that result (#9)
  async function submitQuiz(auto) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setConfirming(false);
    setError('');

    const list = toList(answersRef.current);

    for (let tryNo = 1; auto || tryNo <= 3; tryNo++) {
      if (leftPageRef.current) return;
      try {
        const data = await api('/attempts/' + attemptId + '/submit', 'POST', { answers: list, auto });
        localStorage.removeItem(backupKey);
        // tell the result page if the last answers came too late to be counted
        navigate('/result/' + attemptId, {
          replace: true,
          state: data.lateAnswersIgnored ? { note: data.message } : null
        });
        return;
      } catch (err) {
        if (err.status && err.status < 500) {
          // server replied with an error, no point retrying
          setError(err.message);
          submittedRef.current = false;
          setSubmitting(false);
          return;
        }
        if (auto) {
          setError('Could not reach the server. Trying again, please stay on this page...');
        }
        // no internet or server busy. wait a few sec, a little random so all the
        // students who failed together do not retry at the exact same moment (#18)
        await wait((tryNo <= 3 ? 2000 : 5000) + Math.random() * 1000);
      }
    }

    submittedRef.current = false;
    setSubmitting(false);
    setError('Could not submit because of a network problem. Your answers are kept, please try again.');
  }

  if (error && !quiz) {
    return <p className="error">{error}</p>;
  }
  if (!quiz) {
    return <p>Loading quiz...</p>;
  }

  const answeredCount = quiz.questions.filter((q) => answers[q.id]).length;

  // answers cannot be changed while submitting or after the time is over
  const locked = submitting || timeLeft === 0;

  // question numbers that are still blank, shown before submitting (#9)
  const unanswered = [];
  quiz.questions.forEach((q, index) => {
    if (!answers[q.id]) {
      unanswered.push('Q' + (index + 1));
    }
  });

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
                disabled={locked}
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
                disabled={locked}
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
              disabled={locked}
              onChange={(e) => handleChange(q.id, e.target.value)}
            />
          )}
        </div>
      ))}

      <div className="submit-area">
        {submitting ? (
          <p>{timeLeft === 0 ? 'Time is over. Submitting your answers...' : 'Submitting...'}</p>
        ) : confirming ? (
          <div className="confirm-box">
            <p>
              You answered {answeredCount} of {quiz.questions.length} questions.
              You cannot change answers after submitting. Submit now?
            </p>
            {unanswered.length > 0 && (
              <p className="error">Not answered: {unanswered.join(', ')}</p>
            )}
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

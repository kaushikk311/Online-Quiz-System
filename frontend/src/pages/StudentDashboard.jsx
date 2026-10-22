import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '-';
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    api('/quizzes')
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message));

    api('/attempts/history/' + user.id)
      .then((data) => setAttempts(data))
      .catch((err) => setError(err.message));
  }, [user.id]);

  async function startQuiz(quizId) {
    setError('');
    setStarting(quizId);
    try {
      const data = await api('/attempts/start/' + quizId, 'POST');
      navigate('/attempt/' + data.attemptId);
    } catch (err) {
      setError(err.status ? err.message : 'Cannot connect to server');
      setStarting(null);
    }
  }

  // decides what button to show for a quiz
  function quizAction(q) {
    const running = attempts.find((a) => a.quiz_id === q.id && a.status === 'IN_PROGRESS');

    if (q.status === 'UPCOMING') return <span className="muted">Not started yet</span>;
    if (q.status === 'CLOSED') return <span className="muted">Closed</span>;
    if (running) {
      return <button className="btn btn-small" onClick={() => startQuiz(q.id)}>Continue</button>;
    }
    if (q.attempts_used >= q.max_attempts) return <span className="muted">No attempts left</span>;

    return (
      <button className="btn btn-small" disabled={starting === q.id} onClick={() => startQuiz(q.id)}>
        {starting === q.id ? 'Starting...' : 'Start'}
      </button>
    );
  }

  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>Quizzes</h3>
        {quizzes.length === 0 ? (
          <p className="muted">No quizzes available right now.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Questions</th>
                <th>Time</th>
                <th>Closes</th>
                <th>Attempts</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{q.subject}</td>
                  <td>{q.question_count}</td>
                  <td>{q.time_limit_minutes} min</td>
                  <td>{formatDate(q.end_time)}</td>
                  <td>{q.attempts_used} / {q.max_attempts}</td>
                  <td><span className={'status status-' + q.status.toLowerCase()}>{q.status}</span></td>
                  <td>{quizAction(q)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>My Attempts</h3>
        {attempts.length === 0 ? (
          <p className="muted">You have not attempted any quiz yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Started</th>
                <th>Submitted</th>
                <th>Score</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{formatDate(a.started_at)}</td>
                  <td>
                    {formatDate(a.submitted_at)}
                    {a.submit_type === 'AUTO' && <span className="muted"> (auto)</span>}
                  </td>
                  <td>{a.status === 'SUBMITTED' ? a.score + ' / ' + a.total_marks : '-'}</td>
                  <td>
                    {a.status === 'SUBMITTED'
                      ? <span className={a.passed ? 'pass' : 'fail'}>{a.passed ? 'PASS' : 'FAIL'}</span>
                      : <span className="muted">In progress</span>}
                  </td>
                  <td>
                    {a.status === 'SUBMITTED' && <Link to={'/result/' + a.id}>View</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

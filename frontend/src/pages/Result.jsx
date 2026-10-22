import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

// shows score and pass/fail right after submitting (#11)
export default function Result() {
  const { attemptId } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/attempts/' + attemptId + '/result')
      .then((data) => setResult(data))
      .catch((err) => setError(err.status ? err.message : 'Cannot connect to server'));
  }, [attemptId]);

  if (error) {
    return (
      <div className="card center">
        <p className="error">{error}</p>
        <Link className="btn" to="/">Back to dashboard</Link>
      </div>
    );
  }
  if (!result) {
    return <p>Loading result...</p>;
  }

  return (
    <div className="card center result-card">
      <h2>{result.quizTitle}</h2>

      <div className={result.passed ? 'result-badge pass-bg' : 'result-badge fail-bg'}>
        {result.result}
      </div>

      <p className="big-score">{result.score} / {result.totalMarks}</p>
      <p>Percentage: <b>{result.percentage}%</b> (pass mark is {result.passPercentage}%)</p>

      <p className="muted">
        {result.submitType === 'AUTO' ? 'Submitted automatically when time was over' : 'Submitted by you'}
        {' on '}{new Date(result.submittedAt).toLocaleString()}
      </p>

      <p className="muted">Answer review will come in #13.</p>

      <Link className="btn" to="/">Back to dashboard</Link>
    </div>
  );
}

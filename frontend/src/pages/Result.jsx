import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

// shows score, pass/fail (#11), and allows feedback submission (#16)
export default function Result() {
  const { attemptId } = useParams();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Feedback state (#16)
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);

  useEffect(() => {
    api('/attempts/' + attemptId + '/result')
      .then((data) => {
        setResult(data);
        // Load existing feedback for this quiz if available
        if (data.quizId) {
          api(`/quizzes/${data.quizId}/feedback`)
            .then((fb) => {
              if (fb.userFeedback) {
                setRating(fb.userFeedback.rating);
                setComment(fb.userFeedback.comment || '');
              }
              setFeedbackLoaded(true);
            })
            .catch(() => setFeedbackLoaded(true));
        }
      })
      .catch((err) => setError(err.status ? err.message : 'Cannot connect to server'));
  }, [attemptId]);

  async function handleFeedbackSubmit(e) {
    e.preventDefault();
    if (rating === 0) {
      setFeedbackError('Please select a star rating (1 to 5)');
      return;
    }

    setFeedbackError('');
    setFeedbackSuccess('');
    setSubmittingFeedback(true);

    try {
      await api(`/quizzes/${result.quizId}/feedback`, 'POST', {
        rating,
        comment: comment.trim() || undefined
      });
      setFeedbackSuccess('Thank you! Your feedback has been recorded.');
    } catch (err) {
      setFeedbackError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  }

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
    <div style={{ maxWidth: '600px', margin: '20px auto' }}>
      <div className="card center result-card" style={{ margin: '0 0 20px 0' }}>
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

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
          <Link className="btn" to={`/review/${attemptId}`}>
            Review Answers & Explanations
          </Link>
          <Link className="btn btn-light" to="/" style={{ border: '1px solid #ccc', color: '#333' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Quiz Feedback Section (#16) */}
      {user && user.role === 'STUDENT' && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 8px 0', textAlign: 'center' }}>Rate this Quiz</h3>
          <p className="muted" style={{ textAlign: 'center', margin: '0 0 16px 0', fontSize: '13px' }}>
            Help instructors improve quiz quality by sharing your feedback
          </p>

          {feedbackSuccess && <p className="success" style={{ textAlign: 'center' }}>{feedbackSuccess}</p>}
          {feedbackError && <p className="error" style={{ textAlign: 'center' }}>{feedbackError}</p>}

          <form onSubmit={handleFeedbackSubmit}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div className="star-rating" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`star ${(hoverRating || rating) >= star ? 'filled' : ''}`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    style={{ fontSize: '32px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 'bold' }}>
                Comments / Suggestions (Optional):
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you think of the difficulty, clarity of questions, or time limit?"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #ccc', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                type="submit"
                className="btn"
                disabled={submittingFeedback || rating === 0}
              >
                {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

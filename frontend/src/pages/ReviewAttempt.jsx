import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ReviewAttempt() {
  const { attemptId } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL, CORRECT, INCORRECT

  useEffect(() => {
    setLoading(true);
    api(`/attempts/${attemptId}/review`)
      .then((data) => {
        setReview(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.status ? err.message : 'Cannot connect to server');
        setLoading(false);
      });
  }, [attemptId]);

  if (error) {
    return (
      <div className="card center">
        <p className="error">{error}</p>
        <Link className="btn" to="/history">Back to Attempt History</Link>
      </div>
    );
  }

  if (loading || !review) {
    return <p className="muted" style={{ padding: '20px' }}>Loading answer review...</p>;
  }

  const filteredQuestions = review.questions.filter((q) => {
    if (filter === 'CORRECT') return q.isCorrect;
    if (filter === 'INCORRECT') return !q.isCorrect;
    return true;
  });

  const correctCount = review.questions.filter((q) => q.isCorrect).length;
  const incorrectCount = review.questions.length - correctCount;

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <h2>Review: {review.quizTitle}</h2>
          <p className="muted" style={{ margin: 0 }}>
            Submitted on {new Date(review.submittedAt).toLocaleString()}
            {review.submitType === 'AUTO' && ' (Auto-submitted)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to={`/result/${attemptId}`} className="btn btn-light" style={{ border: '1px solid #ccc', color: '#333' }}>
            Result Summary
          </Link>
          <Link to="/history" className="btn btn-light" style={{ border: '1px solid #ccc', color: '#333' }}>
            Attempt History
          </Link>
        </div>
      </div>

      {/* Score overview card */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '16px', textAlign: 'center', padding: '16px 20px' }}>
        <div>
          <div className="muted" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Score</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{review.score} / {review.totalMarks}</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Percentage</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{review.percentage}%</div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Result</div>
          <span className={`status ${review.passed ? 'status-pass' : 'status-fail'}`} style={{ fontSize: '14px', padding: '4px 14px' }}>
            {review.passed ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        <div>
          <div className="muted" style={{ fontSize: '12px', textTransform: 'uppercase' }}>Correct Questions</div>
          <div style={{ fontSize: '20px', color: '#27ae60', fontWeight: 'bold' }}>
            {correctCount} / {review.questions.length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn btn-small ${filter === 'ALL' ? '' : 'btn-light'}`}
          style={filter !== 'ALL' ? { border: '1px solid #ccc', color: '#333' } : {}}
          onClick={() => setFilter('ALL')}
        >
          All Questions ({review.questions.length})
        </button>
        <button
          className={`btn btn-small ${filter === 'CORRECT' ? '' : 'btn-light'}`}
          style={filter !== 'CORRECT' ? { border: '1px solid #ccc', color: '#333' } : { background: '#27ae60' }}
          onClick={() => setFilter('CORRECT')}
        >
          Correct ({correctCount})
        </button>
        <button
          className={`btn btn-small ${filter === 'INCORRECT' ? '' : 'btn-light'}`}
          style={filter !== 'INCORRECT' ? { border: '1px solid #ccc', color: '#333' } : { background: '#c0392b' }}
          onClick={() => setFilter('INCORRECT')}
        >
          Incorrect / Unanswered ({incorrectCount})
        </button>
      </div>

      {/* Questions List */}
      {filteredQuestions.map((q, idx) => {
        const originalIndex = review.questions.findIndex((item) => item.id === q.id) + 1;
        return (
          <div
            key={q.id}
            className={`card question-review-card ${q.isCorrect ? 'correct' : 'incorrect'}`}
            style={{ padding: '18px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                Question {originalIndex}
                <span className="muted" style={{ fontWeight: 'normal', marginLeft: '8px', fontSize: '12px' }}>
                  ({q.questionType.replace('_', ' ')})
                </span>
              </span>
              <span className={`status ${q.isCorrect ? 'status-pass' : 'status-fail'}`}>
                {q.isCorrect ? `+${q.marks} Marks` : `0 / ${q.marks} Marks`}
              </span>
            </div>

            <p style={{ fontSize: '16px', margin: '8px 0 14px 0' }}>{q.questionText}</p>

            {/* MCQ Options Rendering */}
            {q.questionType === 'MCQ' && q.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {q.options.map((opt, oIdx) => {
                  const isSelected = q.givenAnswer === opt;
                  const isCorrectAnswer = q.correctAnswer === opt;
                  let bg = '#fff';
                  let border = '1px solid #ddd';
                  let badge = null;

                  if (isSelected && isCorrectAnswer) {
                    bg = '#e7f6ec';
                    border = '2px solid #27ae60';
                    badge = <span style={{ color: '#27ae60', fontWeight: 'bold', marginLeft: 'auto' }}>✓ Your Answer (Correct)</span>;
                  } else if (isSelected && !isCorrectAnswer) {
                    bg = '#fdecea';
                    border = '2px solid #c0392b';
                    badge = <span style={{ color: '#b3261e', fontWeight: 'bold', marginLeft: 'auto' }}>✗ Your Answer (Incorrect)</span>;
                  } else if (isCorrectAnswer) {
                    bg = '#e7f6ec';
                    border = '1px dashed #27ae60';
                    badge = <span style={{ color: '#27ae60', fontWeight: 'bold', marginLeft: 'auto' }}>Correct Answer</span>;
                  }

                  return (
                    <div
                      key={oIdx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: bg,
                        border: border,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <span>{opt}</span>
                      {badge}
                    </div>
                  );
                })}
              </div>
            )}

            {/* True/False Options Rendering */}
            {q.questionType === 'TRUE_FALSE' && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                {['True', 'False'].map((opt) => {
                  const isSelected = q.givenAnswer === opt;
                  const isCorrectAnswer = q.correctAnswer.toLowerCase() === opt.toLowerCase();
                  let bg = '#fff';
                  let border = '1px solid #ddd';

                  if (isSelected && isCorrectAnswer) {
                    bg = '#e7f6ec';
                    border = '2px solid #27ae60';
                  } else if (isSelected && !isCorrectAnswer) {
                    bg = '#fdecea';
                    border = '2px solid #c0392b';
                  } else if (isCorrectAnswer) {
                    bg = '#e7f6ec';
                    border = '1px dashed #27ae60';
                  }

                  return (
                    <div
                      key={opt}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        background: bg,
                        border: border,
                        fontWeight: isSelected ? 'bold' : 'normal'
                      }}
                    >
                      {opt} {isSelected && (isCorrectAnswer ? '(Your Answer ✓)' : '(Your Answer ✗)')}
                      {!isSelected && isCorrectAnswer && '(Correct)'}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fill in the Blank Rendering */}
            {q.questionType === 'FILL_BLANK' && (
              <div style={{ marginBottom: '12px', background: '#fcfcfc', padding: '10px', borderRadius: '6px', border: '1px solid #eee' }}>
                <div style={{ marginBottom: '6px' }}>
                  <span className="muted" style={{ fontSize: '13px' }}>Your Answer: </span>
                  <strong style={{ color: q.isCorrect ? '#27ae60' : '#c0392b' }}>
                    {q.givenAnswer || '<No answer provided>'}
                  </strong>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: '13px' }}>Correct Answer: </span>
                  <strong style={{ color: '#27ae60' }}>{q.correctAnswer}</strong>
                </div>
              </div>
            )}

            {/* Explanation section */}
            {q.explanation && (
              <div className="explanation-box">
                <strong>Explanation: </strong>
                <span>{q.explanation}</span>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ textAlign: 'center', margin: '24px 0' }}>
        <Link to="/history" className="btn">
          Back to Attempt History
        </Link>
      </div>
    </div>
  );
}

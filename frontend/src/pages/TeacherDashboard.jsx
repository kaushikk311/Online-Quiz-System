import { useEffect, useState } from 'react';
import { api } from '../api.js';

function formatDate(d) {
  return new Date(d).toLocaleString();
}

export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [feedbackData, setFeedbackData] = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    api('/quizzes')
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message));
  }, []);

  async function viewFeedback(quiz) {
    setSelectedQuiz(quiz);
    setFeedbackData(null);
    setLoadingFeedback(true);
    try {
      const data = await api(`/quizzes/${quiz.id}/feedback`);
      setFeedbackData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFeedback(false);
    }
  }

  return (
    <div>
      <h2>Teacher Dashboard</h2>

      {/* these pages are done by other members, only the access part is ready */}
      <div className="feature-grid">
        <div className="card feature">Create Quiz<span>#4</span></div>
        <div className="card feature">Update / Delete Quiz<span>#5</span></div>
        <div className="card feature">Schedule Quiz<span>#6</span></div>
        <div className="card feature">Performance Reports<span>#14</span></div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>All Quizzes</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Questions</th>
              <th>Time Limit</th>
              <th>Pass %</th>
              <th>Opens</th>
              <th>Closes</th>
              <th>Status</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.id}>
                <td>{q.title}</td>
                <td>{q.subject}</td>
                <td>{q.question_count}</td>
                <td>{q.time_limit_minutes} min</td>
                <td>{q.pass_percentage}%</td>
                <td>{formatDate(q.start_time)}</td>
                <td>{formatDate(q.end_time)}</td>
                <td><span className={'status status-' + q.status.toLowerCase()}>{q.status}</span></td>
                <td>
                  <button
                    className="btn btn-small btn-light"
                    style={{ fontSize: '12px', padding: '3px 8px', border: '1px solid #ccc' }}
                    onClick={() => viewFeedback(q)}
                  >
                    Reviews
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feedback Modal */}
      {selectedQuiz && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0 }}>Feedback: {selectedQuiz.title}</h3>
              <button
                className="btn btn-small btn-light"
                onClick={() => setSelectedQuiz(null)}
                style={{ border: '1px solid #ccc' }}
              >
                ✕ Close
              </button>
            </div>

            {loadingFeedback ? (
              <p className="muted">Loading feedback...</p>
            ) : !feedbackData || feedbackData.feedbacks.length === 0 ? (
              <p className="muted">No student reviews submitted for this quiz yet.</p>
            ) : (
              <div>
                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f39c12' }}>
                    ★ {feedbackData.averageRating}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>Average Student Rating</div>
                    <div className="muted" style={{ fontSize: '13px' }}>Based on {feedbackData.totalCount} ratings</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {feedbackData.feedbacks.map((f) => (
                    <div key={f.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold' }}>{f.student_name}</span>
                        <span style={{ color: '#f39c12' }}>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                      </div>
                      <p style={{ margin: '6px 0', fontSize: '13px', color: '#444' }}>
                        {f.comment || <em className="muted">No comment provided</em>}
                      </p>
                      <span className="muted" style={{ fontSize: '11px' }}>{new Date(f.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

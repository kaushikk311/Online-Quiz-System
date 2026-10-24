import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function formatDate(d) {
  return new Date(d).toLocaleString();
}

// converts a UTC Date / ISO string into a value usable by datetime-local inputs
function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
}

export default function TeacherDashboard() {
  const navigate = useNavigate();

  const [quizzes, setQuizzes]           = useState([]);
  const [error, setError]               = useState('');

  // feedback panel
  const [selectedQuiz, setSelectedQuiz]       = useState(null);
  const [feedbackData, setFeedbackData]       = useState(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // edit modal (#5)
  const [editQuiz, setEditQuiz]   = useState(null);   // quiz being edited
  const [editForm, setEditForm]   = useState({});
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // reschedule modal (#6)
  const [scheduleQuiz, setScheduleQuiz]     = useState(null);
  const [scheduleForm, setScheduleForm]     = useState({ start_time: '', end_time: '' });
  const [scheduleError, setScheduleError]   = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // delete confirmation
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  // ── load quizzes ──────────────────────────────────────────────────────────
  function loadQuizzes() {
    api('/quizzes')
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => { loadQuizzes(); }, []);

  // ── feedback ──────────────────────────────────────────────────────────────
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

  // ── edit (#5) ─────────────────────────────────────────────────────────────
  function openEdit(quiz) {
    setEditQuiz(quiz);
    setEditError('');
    setEditForm({
      title:               quiz.title,
      subject:             quiz.subject || '',
      time_limit_minutes:  quiz.time_limit_minutes,
      pass_percentage:     Number(quiz.pass_percentage),
      start_time:          toLocalInput(quiz.start_time),
      end_time:            toLocalInput(quiz.end_time),
      max_attempts:        quiz.max_attempts
    });
  }

  async function submitEdit(e) {
    e.preventDefault();
    setEditError('');
    if (new Date(editForm.end_time) <= new Date(editForm.start_time)) {
      setEditError('End time must be after start time');
      return;
    }
    setEditLoading(true);
    try {
      await api(`/quizzes/${editQuiz.id}`, 'PUT', {
        title:               editForm.title.trim(),
        subject:             editForm.subject.trim() || undefined,
        time_limit_minutes:  Number(editForm.time_limit_minutes),
        pass_percentage:     Number(editForm.pass_percentage),
        start_time:          new Date(editForm.start_time).toISOString(),
        end_time:            new Date(editForm.end_time).toISOString(),
        max_attempts:        Number(editForm.max_attempts)
      });
      setEditQuiz(null);
      loadQuizzes();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  // ── delete (#5) ───────────────────────────────────────────────────────────
  async function confirmDelete() {
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await api(`/quizzes/${deleteTarget.id}`, 'DELETE');
      setDeleteTarget(null);
      loadQuizzes();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── reschedule (#6) ───────────────────────────────────────────────────────
  function openSchedule(quiz) {
    setScheduleQuiz(quiz);
    setScheduleError('');
    setScheduleForm({
      start_time: toLocalInput(quiz.start_time),
      end_time:   toLocalInput(quiz.end_time)
    });
  }

  async function submitSchedule(e) {
    e.preventDefault();
    setScheduleError('');
    if (new Date(scheduleForm.end_time) <= new Date(scheduleForm.start_time)) {
      setScheduleError('End time must be after start time');
      return;
    }
    setScheduleLoading(true);
    try {
      await api(`/quizzes/${scheduleQuiz.id}/schedule`, 'PUT', {
        start_time: new Date(scheduleForm.start_time).toISOString(),
        end_time:   new Date(scheduleForm.end_time).toISOString()
      });
      setScheduleQuiz(null);
      loadQuizzes();
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduleLoading(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
        <h2 style={{ margin: 0 }}>Teacher Dashboard</h2>
        <button id="btn-create-quiz-nav" className="btn" onClick={() => navigate('/teacher/create')}>
          + Create Quiz
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Quiz list */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>All Quizzes</h3>
        {quizzes.length === 0 ? (
          <p className="muted">No quizzes yet. Create one to get started.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Questions</th>
                <th>Time</th>
                <th>Pass %</th>
                <th>Opens</th>
                <th>Closes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr key={q.id}>
                  <td>{q.title}</td>
                  <td>{q.subject || '—'}</td>
                  <td>{q.question_count}</td>
                  <td>{q.time_limit_minutes} min</td>
                  <td>{q.pass_percentage}%</td>
                  <td>{formatDate(q.start_time)}</td>
                  <td>{formatDate(q.end_time)}</td>
                  <td><span className={'status status-' + q.status.toLowerCase()}>{q.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {/* Feedback */}
                      <button
                        id={'btn-feedback-' + q.id}
                        className="btn btn-light btn-small"
                        style={{ fontSize: '12px', padding: '3px 8px', border: '1px solid #ccc' }}
                        onClick={() => viewFeedback(q)}
                      >
                        Reviews
                      </button>
                      {/* Edit (#5) */}
                      <button
                        id={'btn-edit-' + q.id}
                        className="btn btn-light btn-small"
                        style={{ fontSize: '12px', padding: '3px 8px', border: '1px solid #2c3e8f' }}
                        onClick={() => openEdit(q)}
                        disabled={q.status === 'OPEN'}
                        title={q.status === 'OPEN' ? 'Cannot edit an open quiz' : 'Edit quiz'}
                      >
                        ✏️ Edit
                      </button>
                      {/* Reschedule (#6) */}
                      <button
                        id={'btn-schedule-' + q.id}
                        className="btn btn-light btn-small"
                        style={{ fontSize: '12px', padding: '3px 8px', border: '1px solid #2c3e8f' }}
                        onClick={() => openSchedule(q)}
                        disabled={q.status === 'CLOSED'}
                        title={q.status === 'CLOSED' ? 'Cannot reschedule a closed quiz' : 'Reschedule quiz'}
                      >
                        🗓 Reschedule
                      </button>
                      {/* Delete (#5) */}
                      <button
                        id={'btn-delete-' + q.id}
                        className="btn btn-small"
                        style={{ background: '#c0392b', fontSize: '12px', padding: '3px 8px' }}
                        onClick={() => { setDeleteError(''); setDeleteTarget(q); }}
                        disabled={q.status === 'OPEN'}
                        title={q.status === 'OPEN' ? 'Cannot delete an open quiz' : 'Delete quiz'}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Modal (#5) ───────────────────────────────────────────────── */}
      {editQuiz && (
        <div style={modalOverlayStyle}>
          <div className="card" style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0 }}>Edit Quiz — {editQuiz.title}</h3>
              <button className="btn btn-light btn-small" style={{ border: '1px solid #ccc' }} onClick={() => setEditQuiz(null)}>✕ Close</button>
            </div>
            {editError && <p className="error" style={{ marginTop: 0 }}>{editError}</p>}
            <form onSubmit={submitEdit}>
              <FormRow label="Title *">
                <input id="edit-title" name="title" type="text" maxLength={200} value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
              </FormRow>
              <FormRow label="Subject">
                <input id="edit-subject" name="subject" type="text" value={editForm.subject}
                  onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))} />
              </FormRow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={labelStyle}>Time Limit (min)</label>
                  <input id="edit-time" type="number" min={1} max={300} value={editForm.time_limit_minutes}
                    onChange={(e) => setEditForm((f) => ({ ...f, time_limit_minutes: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelStyle}>Pass %</label>
                  <input id="edit-pass" type="number" min={0} max={100} step="0.01" value={editForm.pass_percentage}
                    onChange={(e) => setEditForm((f) => ({ ...f, pass_percentage: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelStyle}>Max Attempts</label>
                  <input id="edit-attempts" type="number" min={1} max={10} value={editForm.max_attempts}
                    onChange={(e) => setEditForm((f) => ({ ...f, max_attempts: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div>
                  <label style={labelStyle}>Opens At</label>
                  <input id="edit-start" type="datetime-local" value={editForm.start_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, start_time: e.target.value }))}
                    required style={dtStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Closes At</label>
                  <input id="edit-end" type="datetime-local" value={editForm.end_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, end_time: e.target.value }))}
                    required style={dtStyle} />
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button id="btn-edit-save" type="submit" className="btn" disabled={editLoading}>
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-light" style={{ border: '1px solid #ccc' }} onClick={() => setEditQuiz(null)} disabled={editLoading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reschedule Modal (#6) ─────────────────────────────────────────── */}
      {scheduleQuiz && (
        <div style={modalOverlayStyle}>
          <div className="card" style={{ ...modalCardStyle, maxWidth: '440px' }}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0 }}>Reschedule — {scheduleQuiz.title}</h3>
              <button className="btn btn-light btn-small" style={{ border: '1px solid #ccc' }} onClick={() => setScheduleQuiz(null)}>✕ Close</button>
            </div>
            {scheduleError && <p className="error" style={{ marginTop: 0 }}>{scheduleError}</p>}
            <form onSubmit={submitSchedule}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>New Open Time</label>
                  <input id="schedule-start" type="datetime-local" value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, start_time: e.target.value }))}
                    required style={dtStyle} />
                </div>
                <div>
                  <label style={labelStyle}>New Close Time</label>
                  <input id="schedule-end" type="datetime-local" value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, end_time: e.target.value }))}
                    required style={dtStyle} />
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button id="btn-schedule-save" type="submit" className="btn" disabled={scheduleLoading}>
                  {scheduleLoading ? 'Saving…' : 'Update Schedule'}
                </button>
                <button type="button" className="btn btn-light" style={{ border: '1px solid #ccc' }} onClick={() => setScheduleQuiz(null)} disabled={scheduleLoading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Dialog (#5) ────────────────────────────────────── */}
      {deleteTarget && (
        <div style={modalOverlayStyle}>
          <div className="card" style={{ ...modalCardStyle, maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0 }}>Delete Quiz?</h3>
            <p>Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This will also remove all questions and attempt records. This cannot be undone.</p>
            {deleteError && <p className="error">{deleteError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                id="btn-delete-confirm"
                className="btn"
                style={{ background: '#c0392b' }}
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                className="btn btn-light"
                style={{ border: '1px solid #ccc' }}
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Feedback Modal ────────────────────────────────────────────────── */}
      {selectedQuiz && (
        <div style={modalOverlayStyle}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0 }}>Feedback: {selectedQuiz.title}</h3>
              <button className="btn btn-light btn-small" onClick={() => setSelectedQuiz(null)} style={{ border: '1px solid #ccc' }}>✕ Close</button>
            </div>

            {loadingFeedback ? (
              <p className="muted">Loading feedback...</p>
            ) : !feedbackData || feedbackData.feedbacks.length === 0 ? (
              <p className="muted">No student reviews submitted for this quiz yet.</p>
            ) : (
              <div>
                <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f39c12' }}>★ {feedbackData.averageRating}</div>
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

// ── Small shared style helpers ─────────────────────────────────────────────
function FormRow({ label, children }) {
  return (
    <div style={{ marginTop: '12px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const labelStyle = { display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' };
const dtStyle    = { width: '100%', padding: '9px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px' };

const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '16px'
};
const modalCardStyle = {
  maxWidth: '680px', width: '100%',
  maxHeight: '90vh', overflowY: 'auto'
};
const modalHeaderStyle = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', marginBottom: '14px'
};

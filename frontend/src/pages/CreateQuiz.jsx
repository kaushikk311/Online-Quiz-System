import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// returns a local datetime string like "2025-01-15T09:00" for datetime-local inputs
function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
}

// default start = now+1h, default end = now+25h
const defaultStart = toLocalInput(new Date(Date.now() + 60 * 60 * 1000));
const defaultEnd   = toLocalInput(new Date(Date.now() + 25 * 60 * 60 * 1000));

export default function CreateQuiz() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    subject: '',
    time_limit_minutes: 10,
    pass_percentage: 50,
    start_time: defaultStart,
    end_time: defaultEnd,
    max_attempts: 1
  });

  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // basic frontend guard
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (new Date(form.end_time) <= new Date(form.start_time)) {
      setError('End time must be after start time');
      return;
    }

    setLoading(true);
    try {
      await api('/quizzes', 'POST', {
        title: form.title.trim(),
        subject: form.subject.trim() || undefined,
        time_limit_minutes: Number(form.time_limit_minutes),
        pass_percentage: Number(form.pass_percentage),
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        max_attempts: Number(form.max_attempts)
      });
      navigate('/teacher');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <button
          className="btn btn-light btn-small"
          onClick={() => navigate('/teacher')}
          style={{ border: '1px solid #ccc' }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0 }}>Create New Quiz</h2>
      </div>

      <div className="card" style={{ maxWidth: '620px' }}>
        {error && <p className="error" style={{ marginTop: 0 }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <label htmlFor="cq-title" style={{ display: 'block', marginTop: '12px', fontWeight: 'bold', fontSize: '14px' }}>
            Title *
          </label>
          <input
            id="cq-title"
            name="title"
            type="text"
            maxLength={200}
            placeholder="e.g. DBMS Mid-Term"
            value={form.title}
            onChange={handleChange}
            required
          />

          {/* Subject */}
          <label htmlFor="cq-subject" style={{ display: 'block', marginTop: '12px', fontWeight: 'bold', fontSize: '14px' }}>
            Subject <span className="muted">(optional)</span>
          </label>
          <input
            id="cq-subject"
            name="subject"
            type="text"
            placeholder="e.g. Database Management"
            value={form.subject}
            onChange={handleChange}
          />

          {/* Time limit, Pass % and Max attempts - row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label htmlFor="cq-time" style={{ display: 'block', fontWeight: 'bold', fontSize: '14px' }}>
                Time Limit (min) *
              </label>
              <input
                id="cq-time"
                name="time_limit_minutes"
                type="number"
                min={1}
                max={300}
                value={form.time_limit_minutes}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label htmlFor="cq-pass" style={{ display: 'block', fontWeight: 'bold', fontSize: '14px' }}>
                Pass % *
              </label>
              <input
                id="cq-pass"
                name="pass_percentage"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.pass_percentage}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label htmlFor="cq-attempts" style={{ display: 'block', fontWeight: 'bold', fontSize: '14px' }}>
                Max Attempts *
              </label>
              <input
                id="cq-attempts"
                name="max_attempts"
                type="number"
                min={1}
                max={10}
                value={form.max_attempts}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Start / End time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label htmlFor="cq-start" style={{ display: 'block', fontWeight: 'bold', fontSize: '14px' }}>
                Opens At *
              </label>
              <input
                id="cq-start"
                name="start_time"
                type="datetime-local"
                value={form.start_time}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '9px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label htmlFor="cq-end" style={{ display: 'block', fontWeight: 'bold', fontSize: '14px' }}>
                Closes At *
              </label>
              <input
                id="cq-end"
                name="end_time"
                type="datetime-local"
                value={form.end_time}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '9px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button
              id="btn-create-quiz"
              type="submit"
              className="btn"
              disabled={loading}
            >
              {loading ? 'Creating…' : 'Create Quiz'}
            </button>
            <button
              type="button"
              className="btn btn-light"
              style={{ border: '1px solid #ccc' }}
              onClick={() => navigate('/teacher')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

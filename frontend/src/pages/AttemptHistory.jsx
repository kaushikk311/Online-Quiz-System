import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

function formatDate(d) {
  return d ? new Date(d).toLocaleString() : '-';
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function AttemptHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    setLoading(true);
    api(`/attempts/history/${user.id}`)
      .then((data) => {
        setAttempts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user.id]);

  // Derived filtered & sorted attempts
  const filteredAttempts = attempts
    .filter((a) => {
      if (filterStatus === 'SUBMITTED' && a.status !== 'SUBMITTED') return false;
      if (filterStatus === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return false;
      if (filterStatus === 'PASSED' && !a.passed) return false;
      if (filterStatus === 'FAILED' && (a.status !== 'SUBMITTED' || a.passed)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = a.title && a.title.toLowerCase().includes(q);
        const matchesSubject = a.subject && a.subject.toLowerCase().includes(q);
        return matchesTitle || matchesSubject;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.started_at) - new Date(a.started_at);
      if (sortBy === 'oldest') return new Date(a.started_at) - new Date(b.started_at);
      if (sortBy === 'highest_score') return (b.percentage || 0) - (a.percentage || 0);
      if (sortBy === 'lowest_score') return (a.percentage || 0) - (b.percentage || 0);
      return 0;
    });

  // Calculate statistics
  const submittedList = attempts.filter((a) => a.status === 'SUBMITTED');
  const totalSubmitted = submittedList.length;
  const passedCount = submittedList.filter((a) => a.passed).length;
  const passRate = totalSubmitted > 0 ? Math.round((passedCount / totalSubmitted) * 100) : 0;
  const avgPercentage = totalSubmitted > 0
    ? Math.round(submittedList.reduce((acc, cur) => acc + (cur.percentage || 0), 0) / totalSubmitted)
    : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <h2>Attempt History</h2>
          <p className="muted" style={{ margin: 0 }}>Review your past quiz performances, scores, and progress</p>
        </div>
        <Link to="/student" className="btn btn-light" style={{ border: '1px solid #ccc', color: '#333' }}>
          Back to Dashboard
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Summary Analytics Cards */}
      <div className="stat-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '4px solid #2c3e8f' }}>
          <p className="muted" style={{ margin: '0 0 6px 0', fontSize: '13px', textTransform: 'uppercase' }}>Total Attempts</p>
          <h3 style={{ margin: 0, fontSize: '28px', color: '#2c3e8f' }}>{attempts.length}</h3>
          <span className="muted" style={{ fontSize: '12px' }}>{totalSubmitted} submitted</span>
        </div>
        <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '4px solid #27ae60' }}>
          <p className="muted" style={{ margin: '0 0 6px 0', fontSize: '13px', textTransform: 'uppercase' }}>Pass Rate</p>
          <h3 style={{ margin: 0, fontSize: '28px', color: '#27ae60' }}>{passRate}%</h3>
          <span className="muted" style={{ fontSize: '12px' }}>{passedCount} of {totalSubmitted} passed</span>
        </div>
        <div className="card" style={{ margin: 0, textAlign: 'center', borderTop: '4px solid #f39c12' }}>
          <p className="muted" style={{ margin: '0 0 6px 0', fontSize: '13px', textTransform: 'uppercase' }}>Average Score</p>
          <h3 style={{ margin: 0, fontSize: '28px', color: '#f39c12' }}>{avgPercentage}%</h3>
          <span className="muted" style={{ fontSize: '12px' }}>Across submitted quizzes</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by quiz or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ccc', minWidth: '220px' }}
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ccc' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted Only</option>
              <option value="PASSED">Passed Only</option>
              <option value="FAILED">Failed Only</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="muted" style={{ fontSize: '13px' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ccc' }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest_score">Highest Score</option>
              <option value="lowest_score">Lowest Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Attempts Table */}
      <div className="card">
        {loading ? (
          <p className="muted">Loading attempt history...</p>
        ) : filteredAttempts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <p className="muted" style={{ fontSize: '16px' }}>No attempts match the selected criteria.</p>
            {attempts.length === 0 ? (
              <Link to="/student" className="btn">Browse Available Quizzes</Link>
            ) : (
              <button
                className="btn btn-small"
                onClick={() => { setFilterStatus('ALL'); setSearchQuery(''); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Subject</th>
                <th>Started</th>
                <th>Submitted</th>
                <th>Duration</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Result</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.title}</strong>
                    {a.submit_type === 'AUTO' && (
                      <span className="muted" style={{ display: 'block', fontSize: '11px' }}>Auto-submitted</span>
                    )}
                  </td>
                  <td>{a.subject || '-'}</td>
                  <td style={{ fontSize: '13px' }}>{formatDate(a.started_at)}</td>
                  <td style={{ fontSize: '13px' }}>{formatDate(a.submitted_at)}</td>
                  <td>{formatDuration(a.duration_seconds)}</td>
                  <td>
                    {a.status === 'SUBMITTED' ? (
                      <strong>{a.score} / {a.total_marks}</strong>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {a.status === 'SUBMITTED' ? (
                      <span>{a.percentage}%</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {a.status === 'SUBMITTED' ? (
                      <span className={`status ${a.passed ? 'status-pass' : 'status-fail'}`}>
                        {a.passed ? 'PASS' : 'FAIL'}
                      </span>
                    ) : (
                      <span className="status status-inprogress">In Progress</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {a.status === 'SUBMITTED' && (
                        <>
                          <Link to={`/result/${a.id}`} className="btn btn-small" style={{ fontSize: '12px', padding: '4px 8px' }}>
                            Result
                          </Link>
                          <Link to={`/review/${a.id}`} className="btn btn-small btn-light" style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #2c3e8f', color: '#2c3e8f' }}>
                            Review
                          </Link>
                        </>
                      )}
                      {a.status === 'IN_PROGRESS' && (
                        <button
                          className="btn btn-small"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          onClick={() => navigate(`/attempt/${a.id}`)}
                        >
                          Continue
                        </button>
                      )}
                    </div>
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

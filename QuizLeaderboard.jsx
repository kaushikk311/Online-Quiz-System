import { useState } from 'react';
import { api } from '../api.js';

export default function QuizLeaderboard() {
  const [quizId, setQuizId] = useState('');
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState('10');

  async function loadLeaderboard(event) {
    event.preventDefault();
    if (!quizId.trim()) {
      setError('Please enter a quiz ID.');
      return;
    }

    setLoading(true);
    setError('');
    setLeaderboard(null);

    try {
      const params = new URLSearchParams({ quizId: quizId.trim(), limit });
      const data = await api(`/leaderboard?${params.toString()}`);
      setLeaderboard(data);
    } catch (err) {
      setError(err.message || 'Unable to load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }

  const rows = Array.isArray(leaderboard)
    ? leaderboard
    : leaderboard?.leaderboard ?? leaderboard?.results ?? [];

  const styles = {
    page: { minHeight: '100vh', padding: '28px', background: '#0d1117', color: '#e6edf3', fontFamily: 'Arial, sans-serif' },
    panel: { background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '20px', marginBottom: '20px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '11px', marginTop: '7px', borderRadius: '7px', border: '1px solid #484f58', background: '#0d1117', color: '#e6edf3' },
    button: { padding: '11px 18px', border: 0, borderRadius: '7px', background: '#238636', color: '#fff', cursor: 'pointer' },
    cell: { padding: '13px 10px', textAlign: 'left', borderBottom: '1px solid #30363d' },
  };

  return (
    <main style={styles.page}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Quiz leaderboard</h1>
        <p style={{ color: '#8b949e', marginTop: 0 }}>
          Display student rankings based on quiz scores with quiz filtering.
        </p>
      </header>

      <form onSubmit={loadLeaderboard} style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Filter leaderboard</h2>
        <label>
          Quiz ID
          <input
            style={styles.input}
            value={quizId}
            onChange={(event) => setQuizId(event.target.value)}
            placeholder="Enter quiz ID"
            required
          />
        </label>

        <label style={{ display: 'block', marginTop: '16px' }}>
          Number of students
          <select style={styles.input} value={limit} onChange={(event) => setLimit(event.target.value)}>
            <option value="5">Top 5</option>
            <option value="10">Top 10</option>
            <option value="20">Top 20</option>
            <option value="50">Top 50</option>
          </select>
        </label>

        <button type="submit" disabled={loading} style={{ ...styles.button, marginTop: '18px' }}>
          {loading ? 'Loading...' : 'Show leaderboard'}
        </button>
        {error && <p role="alert" style={{ color: '#ff7b72' }}>{error}</p>}
      </form>

      {leaderboard !== null && (
        <section style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>Student rankings</h2>
          {rows.length === 0 ? (
            <p style={{ color: '#8b949e' }}>No leaderboard results were returned for this quiz.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Rank', 'Student', 'Score', 'Percentage'].map((heading) => (
                      <th key={heading} style={styles.cell}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((student, index) => {
                    const score = Number(student.score ?? student.totalScore ?? 0);
                    const percentage = Number(
                      student.percentage ??
                      (student.totalMarks ? (score / Number(student.totalMarks)) * 100 : 0)
                    );
                    return (
                      <tr key={student.studentId ?? student.id ?? index}>
                        <td style={styles.cell}>
                          {student.rank ?? index + 1}
                          {index === 0 ? ' 🥇' : index === 1 ? ' 🥈' : index === 2 ? ' 🥉' : ''}
                        </td>
                        <td style={styles.cell}>
                          {student.studentName ?? student.name ?? `Student ${index + 1}`}
                        </td>
                        <td style={styles.cell}>{score}</td>
                        <td style={styles.cell}>{percentage.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

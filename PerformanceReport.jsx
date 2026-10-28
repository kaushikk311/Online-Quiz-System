import { useState } from 'react';
import { api } from '../api.js';

export default function PerformanceReport() {
  const [quizId, setQuizId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [reportType, setReportType] = useState('class');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateReport(e) {
    e.preventDefault();

    if (!quizId.trim()) {
      setError('Please enter a quiz ID.');
      return;
    }

    if (reportType === 'individual' && !studentId.trim()) {
      setError('Please enter a student ID.');
      return;
    }

    setLoading(true);
    setError('');
    setReport(null);

    try {
      const params = new URLSearchParams({ quizId });
      if (reportType === 'individual') {
        params.set('studentId', studentId);
      }

      const data = await api(
        `/reports/performance?${params.toString()}`
      );

      setReport(data);
    } catch (err) {
      setError(err.message || 'Unable to generate report.');
    } finally {
      setLoading(false);
    }
  }

  const number = (value) => Number(value ?? 0);
  const average = number(report?.averageScore);
  const students = report?.students ?? [];

  const styles = {
    page: {
      minHeight: '100vh',
      padding: '28px',
      background: '#0d1117',
      color: '#e6edf3',
      fontFamily: 'Arial, sans-serif',
    },
    card: {
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '12px',
      padding: '20px',
    },
    input: {
      width: '100%',
      padding: '10px',
      marginTop: '7px',
      boxSizing: 'border-box',
      border: '1px solid #484f58',
      borderRadius: '7px',
      background: '#0d1117',
      color: '#e6edf3',
    },
    button: {
      padding: '11px 18px',
      border: 'none',
      borderRadius: '7px',
      background: '#238636',
      color: 'white',
      cursor: 'pointer',
    },
  };

  return (
    <main style={styles.page}>
      <h1>Quiz Performance Reports</h1>
      <p style={{ color: '#8b949e' }}>
        View individual student performance or class-wide results.
      </p>

      <form
        onSubmit={generateReport}
        style={{
          ...styles.card,
          maxWidth: '650px',
          marginBottom: '24px',
        }}
      >
        <label>
          Report type
          <select
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setReport(null);
              setError('');
            }}
            style={styles.input}
          >
            <option value="class">Class-wide report</option>
            <option value="individual">Individual student report</option>
          </select>
        </label>

        <label style={{ display: 'block', marginTop: '18px' }}>
          Quiz ID
          <input
            style={styles.input}
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            placeholder="Enter quiz ID"
            required
          />
        </label>

        {reportType === 'individual' && (
          <label style={{ display: 'block', marginTop: '18px' }}>
            Student ID
            <input
              style={styles.input}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="Enter student ID"
              required
            />
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ ...styles.button, marginTop: '20px' }}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>

        {error && (
          <p role="alert" style={{ color: '#ff7b72' }}>
            {error}
          </p>
        )}
      </form>

      {report && reportType === 'class' && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            {[
              ['Students', report.totalStudents],
              ['Class average', `${average.toFixed(1)}%`],
              ['Highest score', `${number(report.highestScore)}%`],
              ['Lowest score', `${number(report.lowestScore)}%`],
            ].map(([label, value]) => (
              <section key={label} style={styles.card}>
                <p style={{ color: '#8b949e' }}>{label}</p>
                <h2>{value ?? '—'}</h2>
              </section>
            ))}
          </div>

          <section style={styles.card}>
            <h2>Student Results</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th align="left">Student</th>
                    <th align="left">Score</th>
                    <th align="left">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.studentName}</td>
                      <td>
                        {student.score} / {student.totalMarks}
                      </td>
                      <td>{number(student.percentage).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {students.length === 0 && (
              <p>No student results are available for this quiz.</p>
            )}
          </section>
        </>
      )}

      {report && reportType === 'individual' && (
        <section style={{ ...styles.card, maxWidth: '650px' }}>
          <h2>{report.studentName || 'Student Performance'}</h2>
          <p>Quiz: {report.quizTitle || quizId}</p>
          <h3>
            Score: {report.score ?? 0} / {report.totalMarks ?? 0}
          </h3>
          <h3>
            Percentage: {number(report.percentage).toFixed(1)}%
          </h3>
          <p>Correct answers: {report.correctAnswers ?? '—'}</p>
          <p>Incorrect answers: {report.incorrectAnswers ?? '—'}</p>
        </section>
      )}
    </main>
  );
}

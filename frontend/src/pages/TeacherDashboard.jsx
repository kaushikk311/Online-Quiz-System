import { useEffect, useState } from 'react';
import { api } from '../api.js';

function formatDate(d) {
  return new Date(d).toLocaleString();
}

export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/quizzes')
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message));
  }, []);

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

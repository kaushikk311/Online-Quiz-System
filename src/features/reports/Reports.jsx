import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { classReport, listReportQuizzes, listReportStudents, studentReport } from '../../services/reports.js';
import { navigate } from '../../router.js';
import { formatDateTime, formatDuration } from '../../utils/format.js';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader } from '../../components/ui.jsx';

const Strip = ({ items }) => <div className="strip">{items.map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>;

function ClassReport({ quizzes }) {
  const { user } = useAuth();
  const [quizId, setQuizId] = useState(() => (quizzes.find((q) => q.attempts > 0) || quizzes[0])?.id || '');
  const [res, reload] = useService(() => (quizId ? classReport(user, quizId) : null), [user.id, quizId]);
  return (
    <>
      <div className="toolbar"><Field id="cr-quiz" label="Quiz"><select id="cr-quiz" value={quizId} onChange={(e) => setQuizId(e.target.value)}>{quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.attempts})</option>)}</select></Field></div>
      {!quizId ? <EmptyState title="No quizzes yet">Create a quiz and have students attempt it to see class analytics.</EmptyState>
        : !res.ok ? <ErrorState message={res.error} onRetry={reload} />
        : res.data.stats.attempts === 0 ? <EmptyState title="No attempts recorded">Nobody has submitted “{res.data.quiz.title}” yet. Analytics appear after the first submission.</EmptyState>
        : (() => {
          const { stats, buckets, rows, questions } = res.data, max = Math.max(1, ...buckets.map((b) => b.count));
          return (
            <>
              <Strip items={[['Attempts', stats.attempts], ['Students', stats.students], ['Average', `${stats.average}%`], ['Highest', `${stats.highest}%`], ['Lowest', `${stats.lowest}%`], ['Pass rate', `${stats.passRate}%`]]} />
              <div className="grid-2">
                <div className="sheet"><h3>Score spread (% of attempts)</h3><div className="bars">{buckets.map((b) => <div className="bar-row" key={b.label}><span>{b.label}</span><div className="bar"><i style={{ width: `${(b.count / max) * 100}%` }} /></div><strong>{b.count}</strong></div>)}</div></div>
                <div className="sheet"><h3>Question difficulty</h3>{questions.map((q) => <p key={q.text} style={{ marginBottom: 8 }}><span className="rate-bar"><i style={{ width: `${q.rate}%` }} /></span><strong>{q.rate}%</strong> <span className="muted small">{q.text}</span></p>)}</div>
              </div>
              <h3 style={{ margin: '8px 0 12px' }}>All attempts</h3>
              <div className="table-wrap"><table><thead><tr><th>Student</th><th>Score</th><th>Percentage</th><th>Result</th><th>Submitted</th><th>Time taken</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.score}/{r.total}</td><td>{r.percentage}%</td><td><Badge tone={r.passed ? 'pass' : 'fail'}>{r.passed ? 'Passed' : 'Not passed'}</Badge></td><td>{formatDateTime(r.submittedAt)}</td><td>{formatDuration(r.timeTaken)}</td></tr>)}</tbody></table></div>
              <p className="hint">Statistics use every submitted attempt stored for this quiz, including repeat attempts.</p>
            </>
          );
        })()}
    </>
  );
}

function StudentReport({ students }) {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [res, reload] = useService(() => (studentId ? studentReport(user, studentId) : null), [user.id, studentId]);
  return (
    <>
      <div className="toolbar"><Field id="sr-student" label="Student"><select id="sr-student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        {studentId && <Button variant="secondary" onClick={() => navigate(`/history/${studentId}`)}>View attempt log</Button>}</div>
      {!studentId ? <EmptyState title="No students yet">Student reports appear once students exist.</EmptyState>
        : !res.ok ? <ErrorState message={res.error} onRetry={reload} />
        : res.data.rows.length === 0 ? <EmptyState title="No attempts recorded">{res.data.student.name} hasn’t submitted any quiz yet.</EmptyState>
        : (
          <>
            <Strip items={[['Attempts', res.data.summary.attempts], ['Quizzes taken', res.data.summary.quizzes], ['Average', `${res.data.summary.average}%`], ['Best', `${res.data.summary.best}%`], ['Pass rate', `${res.data.summary.passRate}%`]]} />
            <h3 style={{ marginBottom: 12 }}>By quiz</h3>
            <div className="table-wrap" style={{ marginBottom: 24 }}><table><thead><tr><th>Quiz</th><th>Attempts</th><th>Best</th><th>Latest</th></tr></thead>
              <tbody>{res.data.perQuiz.map((p) => <tr key={p.quizId}><td><strong>{p.quizTitle}</strong></td><td>{p.attempts}</td><td>{p.best}%</td><td>{p.latest}%</td></tr>)}</tbody></table></div>
            <h3 style={{ marginBottom: 12 }}>Every attempt</h3>
            <div className="table-wrap"><table><thead><tr><th>Quiz</th><th>Score</th><th>Percentage</th><th>Result</th><th>Submitted</th><th>Time taken</th></tr></thead>
              <tbody>{res.data.rows.map((r) => <tr key={r.id}><td>{r.quizTitle}</td><td>{r.score}/{r.total}</td><td>{r.percentage}%</td><td><Badge tone={r.passed ? 'pass' : 'fail'}>{r.passed ? 'Passed' : 'Not passed'}</Badge></td><td>{formatDateTime(r.submittedAt)}</td><td>{formatDuration(r.timeTaken)}</td></tr>)}</tbody></table></div>
          </>
        )}
    </>
  );
}

/** FR6 / UC06 – class-wide and individual performance reports for Admins and Teachers. */
export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState('class');
  const [quizzes, reloadQ] = useService(() => listReportQuizzes(user), [user.id]);
  const [students, reloadS] = useService(() => listReportStudents(user), [user.id]);
  const err = !quizzes.ok ? quizzes : !students.ok ? students : null;
  return (
    <>
      <PageHeader title="Reports and analytics" subtitle="Built from the scores stored for every submitted attempt." />
      <div className="tabs" role="tablist">
        <button className={`tab${tab === 'class' ? ' active' : ''}`} role="tab" aria-selected={tab === 'class'} onClick={() => setTab('class')}>Class report</button>
        <button className={`tab${tab === 'student' ? ' active' : ''}`} role="tab" aria-selected={tab === 'student'} onClick={() => setTab('student')}>Student report</button>
      </div>
      {err ? <ErrorState message={err.error} onRetry={() => { reloadQ(); reloadS(); }} /> : tab === 'class' ? <ClassReport quizzes={quizzes.data} /> : <StudentReport students={students.data} />}
    </>
  );
}

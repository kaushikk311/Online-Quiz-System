import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { listAttempts } from '../../services/attempts.js';
import { navigate } from '../../router.js';
import { formatDateTime, formatDuration } from '../../utils/format.js';
import { AccessDenied, Badge, Button, EmptyState, ErrorState, PageHeader } from '../../components/ui.jsx';

/** FR12 / UC12 – a student's own attempts. Another student's history is refused. */
export default function AttemptHistory({ userId }) {
  const { user } = useAuth();
  const [res, reload] = useService(() => listAttempts(user, userId), [user.id, userId]);

  if (!res.ok) {
    return res.code === 'FORBIDDEN' ? <AccessDenied title="This history is private" message={res.error} backTo="/history" backLabel="Go to my attempts" /> : <ErrorState message={res.error} onRetry={reload} />;
  }
  const { student, rows } = res.data;
  const own = student.id === user.id;

  return (
    <>
      <PageHeader title={own ? 'My attempts' : `${student.name}’s attempts`} subtitle="Date, score and time taken for every quiz attempt." />
      {rows.length === 0 ? (
        <EmptyState title="No attempts yet" action={own && <Button onClick={() => navigate('/quizzes')}>Find a quiz</Button>}>{own ? 'Once you submit a quiz it will be recorded here.' : 'This student hasn’t attempted any quiz.'}</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Quiz</th><th>Date</th><th>Score</th><th>Result</th><th>Time taken</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.quizTitle}</strong>{r.submitReason === 'timeout' && <span className="sub">Auto-submitted when time ran out</span>}</td>
                <td className="nowrap">{formatDateTime(r.startedAt)}</td>
                <td>{r.status === 'submitted' ? <>{r.score}/{r.total} <span className="muted">({r.percentage}%)</span></> : <span className="muted">—</span>}</td>
                <td>{r.status === 'in_progress' ? <Badge tone="warn">In progress</Badge> : <Badge tone={r.passed ? 'pass' : 'fail'}>{r.passed ? 'Passed' : 'Not passed'}</Badge>}</td>
                <td>{formatDuration(r.timeTaken)}</td>
                <td className="actions">
                  {own && (r.status === 'submitted' ? <Button variant="secondary" small onClick={() => navigate(`/review/${r.id}`)}>Review</Button>
                    : <><span className="muted small">Review opens after submission</span> {r.quizExists && <Button small onClick={() => navigate(`/attempt/${r.quizId}`)}>Resume</Button>}</>)}
                </td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

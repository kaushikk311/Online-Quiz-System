import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { getResult } from '../../services/attempts.js';
import { navigate } from '../../router.js';
import { formatDuration } from '../../utils/format.js';
import { AccessDenied, Badge, Button, ErrorState, Notice, PageHeader } from '../../components/ui.jsx';

/** FR4 / UC04 – score and pass/fail shown immediately after submission. */
export default function ResultScreen({ attemptId }) {
  const { user } = useAuth();
  const [res, reload] = useService(() => getResult(user, attemptId), [user.id, attemptId]);

  if (!res.ok) {
    if (res.code === 'NOT_SUBMITTED') return <AccessDenied title="No result yet" message={res.error} backTo="/quizzes" backLabel="Back to quizzes" />;
    if (res.code === 'FORBIDDEN' || res.code === 'NOT_FOUND') return <AccessDenied title="You can’t open this result" message={res.error} backTo="/quizzes" backLabel="Back to quizzes" />;
    return <ErrorState message={res.error} onRetry={reload} />;
  }
  const r = res.data;
  const cls = r.passed ? 'pass' : 'fail';

  return (
    <>
      <PageHeader title={r.quizTitle} subtitle="Your result" />
      {r.autoSubmitted && <Notice tone="warning" title="Submitted automatically">Time ran out, so your attempt was submitted for you. Every question you had answered was kept.</Notice>}
      <div className="sheet">
        <div className="result-hero">
          <div className={`score-ring ${cls}`} role="img" aria-label={`Score ${r.score} out of ${r.total}`}><strong>{r.score}/{r.total}</strong><span>{r.percentage}%</span></div>
          <div>
            <p className="verdict" style={{ color: r.passed ? 'var(--pass)' : 'var(--fail)' }}>{r.passed ? 'Passed' : 'Not passed'}</p>
            <p className="muted">Pass mark: {r.passingPercentage}% · Time taken: {formatDuration(r.timeTaken)}</p>
            <p><Badge tone="pass">{r.result.correct} correct</Badge> <Badge tone="fail">{r.result.incorrect + r.result.invalid} incorrect</Badge> <Badge tone="warn">{r.result.unanswered} unanswered</Badge></p>
          </div>
        </div>
        <div className="page-actions" style={{ marginTop: 24 }}>
          <Button onClick={() => navigate(`/review/${r.id}`)}>Review answers</Button>
          {r.passed && <Button variant="secondary" onClick={() => navigate(`/feedback/${r.quizId}`)}>Rate this quiz</Button>}
          <Button variant="secondary" onClick={() => navigate(`/leaderboard/${r.quizId}`)}>See leaderboard</Button>
          <Button variant="ghost" onClick={() => navigate('/quizzes')}>Back to quizzes</Button>
        </div>
      </div>
    </>
  );
}

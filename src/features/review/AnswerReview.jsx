import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { getReview } from '../../services/attempts.js';
import { navigate } from '../../router.js';
import { AccessDenied, Badge, Button, ErrorState, Notice, PageHeader } from '../../components/ui.jsx';

const LABEL = { correct: ['pass', 'Correct'], incorrect: ['fail', 'Incorrect'], unanswered: ['warn', 'Not answered'], invalid: ['fail', 'Not counted'] };

/** FR8 / UC08 – selected answers, correct answers and explanations. Only for the owner, only after submission. */
export default function AnswerReview({ attemptId }) {
  const { user } = useAuth();
  const [res, reload] = useService(() => getReview(user, attemptId), [user.id, attemptId]);
  const [onlyWrong, setOnlyWrong] = useState(false);

  if (!res.ok) {
    if (res.code === 'NOT_SUBMITTED') return <AccessDenied title="Review isn’t available yet" message={`${res.error} Finish and submit the quiz first.`} backTo="/quizzes" backLabel="Back to quizzes" />;
    if (res.code === 'FORBIDDEN' || res.code === 'NOT_FOUND') return <AccessDenied title="You can’t open this review" message={res.error} backTo="/history" backLabel="Back to my attempts" />;
    if (res.code === 'UNAVAILABLE') return <Notice tone="warning" title="Nothing to review">{res.error}</Notice>;
    return <ErrorState message={res.error} onRetry={reload} />;
  }
  const { attempt, items } = res.data;
  const shown = onlyWrong ? items.filter((i) => i.status !== 'correct') : items;

  return (
    <>
      <PageHeader title={`Review: ${attempt.quizTitle}`} subtitle={`You scored ${attempt.score}/${attempt.total} (${attempt.percentage}%).`}
        actions={<><label className="check" style={{ margin: 0 }}><input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /><span>Only show what I missed</span></label><Button variant="secondary" onClick={() => navigate('/history')}>Back to attempts</Button></>} />
      {shown.length === 0 ? <Notice tone="success" title="Nothing missed">You answered every question correctly.</Notice> : shown.map((it) => {
        const n = items.indexOf(it) + 1, [tone, text] = LABEL[it.status];
        return (
          <article className={`rv ${it.status}`} key={it.id}>
            <Badge tone={tone}>{text}</Badge>
            <h3>{n}. {it.text}</h3>
            <dl>
              <dt>Your answer</dt><dd>{it.selectedLabel ?? <span className="muted">No answer given</span>}</dd>
              <dt>Correct answer</dt><dd>{it.correctLabel}</dd>
            </dl>
            {it.explanation && <p className="why"><strong>Why: </strong>{it.explanation}</p>}
          </article>
        );
      })}
    </>
  );
}

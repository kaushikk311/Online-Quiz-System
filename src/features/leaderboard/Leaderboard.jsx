import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { getLeaderboard } from '../../services/leaderboard.js';
import { listQuizzes } from '../../services/quizzes.js';
import { navigate } from '../../router.js';
import { formatDuration } from '../../utils/format.js';
import { Badge, EmptyState, ErrorState, Field, Notice, PageHeader } from '../../components/ui.jsx';

/** FR7 / UC07 – ranking for one quiz, with a clear rule for ties. */
export default function Leaderboard({ quizId }) {
  const { user } = useAuth();
  const [quizzes] = useService(() => listQuizzes(user), [user.id]);
  const selected = quizId || (quizzes.ok && quizzes.data[0]?.id) || '';
  const [res, reload] = useService(() => (selected ? getLeaderboard(user, selected) : null), [user.id, selected]);

  if (!quizzes.ok) return <ErrorState message={quizzes.error} onRetry={reload} />;
  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Each student’s best attempt on the quiz you choose." />
      <div className="toolbar">
        <Field id="lb-quiz" label="Quiz">
          <select id="lb-quiz" value={selected} onChange={(e) => navigate(`/leaderboard/${e.target.value}`)}>
            {quizzes.data.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
        </Field>
      </div>
      {!selected ? <EmptyState title="No quizzes to rank">Rankings appear once a quiz exists and students have taken it.</EmptyState>
        : !res.ok ? <ErrorState message={res.error} onRetry={reload} />
        : res.data.entries.length === 0 ? <EmptyState title="No attempts yet">Nobody has finished “{res.data.quiz.title}” yet, so there are no rankings to show.</EmptyState>
        : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Percentage</th><th>Time taken</th></tr></thead>
                <tbody>{res.data.entries.map((e) => (
                  <tr key={e.userId} className={e.userId === user.id ? 'me' : ''}>
                    <td><span className={`rank${e.rank === 1 ? ' r1' : ''}`}>{e.rank}</span></td>
                    <td><strong>{e.name}</strong>{e.userId === user.id && <> <Badge tone="warn">You</Badge></>}{e.tied && <> <Badge>Tied</Badge></>}</td>
                    <td>{e.score}/{e.total}</td><td>{e.percentage}%</td><td>{formatDuration(e.timeTaken)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>{res.data.tieRule}</p>
          </>
        )}
    </>
  );
}

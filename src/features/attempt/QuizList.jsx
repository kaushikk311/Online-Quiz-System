import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { listQuizzes } from '../../services/quizzes.js';
import { listCategories } from '../../services/categories.js';
import { getReview } from '../../services/attempts.js';
import { navigate } from '../../router.js';
import { Badge, Button, EmptyState, ErrorState, Field, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import Stars from '../../components/Stars.jsx';

const TONE = { open: 'open', upcoming: 'upcoming', closed: 'closed', unscheduled: 'warn', empty: 'warn' };
const LABEL = { open: 'Open now', upcoming: 'Not open yet', closed: 'Closed', unscheduled: 'Not scheduled', empty: 'Unavailable' };

/** UC03 steps 1–3 – the student's quiz list, with a clear state for every quiz (NFR4). */
export default function QuizList() {
  const { user } = useAuth();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [res, reload] = useService(() => listQuizzes(user, { categoryId }), [user.id, categoryId]);
  const [cats] = useService(() => listCategories(user), [user.id]);

  const tryReview = (q) => {
    const r = getReview(user, q.inProgressId);
    if (!r.ok) toast(r.error, 'error'); else navigate(`/review/${q.inProgressId}`);
  };

  return (
    <>
      <PageHeader title="Your quizzes" subtitle="Pick an open quiz to begin. Closed and upcoming quizzes are shown so you know what’s coming." />
      <div className="toolbar">
        <Field id="sq-cat" label="Subject"><select id="sq-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All subjects</option>{cats.ok && cats.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      {!res.ok ? <ErrorState message={res.error} onRetry={reload} /> : res.data.length === 0 ? (
        <EmptyState title={categoryId ? 'No quizzes in this subject' : 'No quizzes yet'} action={categoryId && <Button variant="secondary" onClick={() => setCategoryId('')}>Show all subjects</Button>}>
          {categoryId ? 'Try another subject.' : 'Your teachers haven’t published any quizzes. Check back soon.'}</EmptyState>
      ) : res.data.map((q) => {
        const s = q.availability.state;
        const exhausted = s === 'open' && !q.inProgressId && q.attemptsLeft === 0;
        return (
          <article className={`quiz-row s-${s}`} key={q.id}>
            <span className="stripe" aria-hidden="true" />
            <div className="body">
              <h3>{q.title}</h3>
              <div className="meta"><span>{q.subjectName}</span><span>{q.questionCount} questions</span><span>{q.timeLimit} min</span><span>Pass at {q.passingPercentage}%</span>
                <span>{q.attemptsLeft == null ? 'Unlimited attempts' : `${q.attemptsUsed} of ${q.maxAttempts} attempt${q.maxAttempts > 1 ? 's' : ''} used`}</span></div>
              <p className="state-line"><Badge tone={exhausted ? 'fail' : TONE[s]}>{exhausted ? 'No attempts left' : q.inProgressId ? 'In progress' : LABEL[s]}</Badge><span className="muted">{exhausted ? (q.maxAttempts === 1 ? 'This quiz allows a single attempt.' : 'You have used every attempt.') : q.availability.message}</span></p>
              <p className="state-line"><Stars value={q.avgRating} count={q.ratingCount} /></p>
            </div>
            <div className="side">
              {q.inProgressId ? <><Button onClick={() => navigate(`/attempt/${q.id}`)}>Resume quiz</Button><Button variant="ghost" small onClick={() => tryReview(q)}>Review answers</Button></>
                : s === 'open' && !exhausted ? <Button onClick={() => navigate(`/attempt/${q.id}`)}>{q.attemptsUsed ? 'Start another attempt' : 'Start quiz'}</Button>
                : <Button variant="secondary" onClick={() => navigate(`/attempt/${q.id}`)}>View details</Button>}
              {q.lastAttemptId && <Button variant="ghost" small onClick={() => navigate(`/result/${q.lastAttemptId}`)}>Last result</Button>}
              {q.passed && <Button variant="ghost" small onClick={() => navigate(`/feedback/${q.id}`)}>Rate this quiz</Button>}
            </div>
          </article>
        );
      })}
    </>
  );
}

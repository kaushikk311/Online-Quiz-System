import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { getFeedbackSummary, submitFeedback } from '../../services/feedback.js';
import { navigate } from '../../router.js';
import { formatDate } from '../../utils/format.js';
import { AccessDenied, Button, ErrorState, Field, Notice, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import Stars from '../../components/Stars.jsx';

/** FR13 / UC13 – rate a quiz you passed, and see the average rating. */
export default function FeedbackPage({ quizId }) {
  const { user } = useAuth();
  const toast = useToast();
  const [res, reload] = useService(() => getFeedbackSummary(user, quizId), [user.id, quizId]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [seeded, setSeeded] = useState(false);

  if (!res.ok) return res.code === 'NOT_FOUND' ? <AccessDenied title="Quiz not found" message={res.error} backTo="/" /> : <ErrorState message={res.error} onRetry={reload} />;
  const d = res.data;
  if (!seeded && d.mine) { setRating(d.mine.rating); setComment(d.mine.comment || ''); setSeeded(true); }

  const submit = (e) => {
    e.preventDefault();
    const r = submitFeedback(user, quizId, { rating, comment });
    if (!r.ok) { setErrors(r.errors || {}); setFormError(Object.keys(r.errors || {}).length ? '' : r.error); return; }   // never claim success on failure
    setErrors({}); setFormError('');
    toast('Thanks — your feedback was submitted'); reload();
  };

  return (
    <>
      <PageHeader title={`Feedback: ${d.quiz.title}`} subtitle="What students think of this quiz." actions={<Button variant="ghost" onClick={() => window.history.back()}>Back</Button>} />
      <div className="strip"><div><span>Average rating</span><strong>{d.average == null ? '—' : d.average.toFixed(1)}</strong></div><div><span>Ratings</span><strong>{d.count}</strong></div><div style={{ display: 'grid', alignContent: 'center' }}><Stars value={d.average} /></div></div>

      {d.isStudent && (d.canSubmit ? (
        <form className="sheet" onSubmit={submit} noValidate>
          <h2>{d.mine ? 'Update your rating' : 'Rate this quiz'}</h2>
          {formError && <Notice tone="error">{formError}</Notice>}
          <div className="rate" role="radiogroup" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => { setRating(n); setErrors({ ...errors, rating: undefined }); }}>★</button>)}
          </div>
          {errors.rating && <p className="error-text" role="alert">{errors.rating}</p>}
          <Field id="fb-comment" label="Comment (optional)" error={errors.comment}><textarea id="fb-comment" value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} /></Field>
          <Button type="submit">{d.mine ? 'Update feedback' : 'Submit feedback'}</Button>
        </form>
      ) : <Notice tone="info" title="Feedback opens when you pass">Only students who have passed a quiz can rate it. Pass this quiz to share your rating.</Notice>)}

      <div className="sheet">
        <h2>Comments</h2>
        {d.comments.length === 0 ? <p className="muted">No comments yet.</p> : d.comments.map((c) => (
          <div className="comment" key={c.id}><Stars value={c.rating} /> <strong>{c.name}</strong> <span className="muted small">· {formatDate(c.createdAt)}</span><p style={{ margin: '4px 0 0' }}>{c.comment}</p></div>
        ))}
      </div>
    </>
  );
}

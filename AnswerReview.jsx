import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function normalizeAnswerReview(data) {
  // Accept either { questions: [...] } or a direct array from the API.
  const questions = Array.isArray(data) ? data : data?.questions || [];

  return questions.map((question, index) => ({
    id: question.id ?? question.questionId ?? index + 1,
    question: question.question_text ?? question.question ?? `Question ${index + 1}`,
    type: question.question_type ?? question.type ?? 'MCQ',
    options: question.options ?? [],
    selectedAnswer:
      question.selectedAnswer ?? question.selected_answer ?? question.studentAnswer ?? null,
    correctAnswer:
      question.correctAnswer ?? question.correct_answer ?? question.answer ?? null,
    explanation: question.explanation ?? question.explanation_text ?? '',
    marks: question.marks ?? 1,
    awardedMarks: question.awardedMarks ?? question.awarded_marks ?? null,
    isCorrect:
      question.isCorrect ??
      question.is_correct ??
      (question.selectedAnswer != null &&
        question.correctAnswer != null &&
        String(question.selectedAnswer).trim().toLowerCase() ===
          String(question.correctAnswer).trim().toLowerCase()),
  }));
}

export default function AnswerReview() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    let active = true;

    async function loadReview() {
      setLoading(true);
      setError('');

      try {
        // The backend should return the student's submitted answers,
        // correct answers, marks, and explanations for this attempt.
        const data = await api(`/attempts/${attemptId}/review`);
        if (active) setReview(data);
      } catch (err) {
        if (active) {
          setError(
            err?.status === 404
              ? 'Answer review is not available for this attempt yet.'
              : err?.message || 'Could not load answer review. Please try again.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (attemptId) loadReview();
    else {
      setError('No quiz attempt was specified.');
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [attemptId]);

  const questions = useMemo(
    () => (review ? normalizeAnswerReview(review) : []),
    [review]
  );

  const filteredQuestions = useMemo(() => {
    if (filter === 'CORRECT') return questions.filter((q) => q.isCorrect);
    if (filter === 'INCORRECT') return questions.filter((q) => !q.isCorrect);
    return questions;
  }, [questions, filter]);

  const correctCount = questions.filter((q) => q.isCorrect).length;
  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
  const awardedMarks = questions.reduce(
    (sum, q) =>
      sum + Number(q.awardedMarks ?? (q.isCorrect ? q.marks : 0) ?? 0),
    0
  );

  if (loading) {
    return (
      <div className="answer-review-page">
        <p className="muted">Loading answer review...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="answer-review-page">
        <div className="review-message error" role="alert">{error}</div>
        <button className="btn btn-light" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <main className="answer-review-page">
      <header className="review-header">
        <div>
          <p className="review-eyebrow">QUIZ REVIEW</p>
          <h2>{review?.quizTitle ?? review?.title ?? 'Answer review'}</h2>
          <p className="muted">
            Review your selected answers, correct answers, and explanations.
          </p>
        </div>
        <button className="btn btn-light" onClick={() => navigate(-1)}>
          Back
        </button>
      </header>

      <section className="review-summary card">
        <div className="summary-item">
          <span className="summary-label">Correct answers</span>
          <strong>{correctCount} / {questions.length}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">Score</span>
          <strong>{awardedMarks} / {totalMarks}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">Questions reviewed</span>
          <strong>{questions.length}</strong>
        </div>
      </section>

      <nav className="review-filters" aria-label="Filter questions">
        {[
          ['ALL', `All (${questions.length})`],
          ['CORRECT', `Correct (${correctCount})`],
          ['INCORRECT', `Incorrect (${questions.length - correctCount})`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`filter-btn ${filter === value ? 'active' : ''}`}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
          >
            {label}
          </button>
        ))}
      </nav>

      {filteredQuestions.length === 0 ? (
        <div className="card review-empty">No questions match this filter.</div>
      ) : (
        <section className="review-question-list">
          {filteredQuestions.map((question, index) => (
            <article className="card review-question" key={question.id}>
              <div className="question-heading">
                <h3>Question {questions.findIndex((q) => q.id === question.id) + 1}</h3>
                <span className={`review-status ${question.isCorrect ? 'correct' : 'incorrect'}`}>
                  {question.isCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </div>

              <p className="review-question-text">{question.question}</p>

              {question.options.length > 0 && (
                <div className="review-options">
                  {question.options.map((option, optionIndex) => {
                    const optionText =
                      typeof option === 'string'
                        ? option
                        : option?.text ?? option?.value ?? String(option);
                    const isSelected =
                      String(question.selectedAnswer) === String(optionText);
                    const isAnswer =
                      String(question.correctAnswer) === String(optionText);

                    return (
                      <div
                        key={`${question.id}-${optionIndex}`}
                        className={[
                          'review-option',
                          isAnswer ? 'is-correct' : '',
                          isSelected && !isAnswer ? 'is-selected-wrong' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <span>{optionText}</span>
                        <span className="option-indicators">
                          {isSelected && <small>Your answer</small>}
                          {isAnswer && <small>Correct answer</small>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="answer-comparison">
                <div>
                  <span className="answer-label">Your answer</span>
                  <p>{question.selectedAnswer ?? 'Not answered'}</p>
                </div>
                <div>
                  <span className="answer-label">Correct answer</span>
                  <p>{question.correctAnswer ?? 'Not provided'}</p>
                </div>
              </div>

              {question.explanation && (
                <div className="review-explanation">
                  <strong>Explanation</strong>
                  <p>{question.explanation}</p>
                </div>
              )}

              <footer className="question-marks">
                Marks: {question.awardedMarks ?? (question.isCorrect ? question.marks : 0)}
                {' / '}{question.marks}
              </footer>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

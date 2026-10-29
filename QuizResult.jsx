import React, { useMemo, useState } from "react";

/**
 * Quiz component that calculates a student's score and immediately displays
 * the score plus PASS / FAIL status after submission.
 *
 * Props:
 *   questions: [{ id, question, options: string[], correctAnswer: string }]
 *   passingPercentage: number (defaults to 40)
 *   title: string (optional)
 *
 * Example:
 * <QuizResult questions={myQuestions} passingPercentage={50} />
 */
export default function QuizResult({
  title = "Online Quiz",
  passingPercentage = 40,
  questions = [
    {
      id: 1,
      question: "Which language is primarily used to style web pages?",
      options: ["HTML", "CSS", "SQL", "Python"],
      correctAnswer: "CSS",
    },
    {
      id: 2,
      question: "Which one is a JavaScript library for building user interfaces?",
      options: ["React", "MySQL", "Git", "Linux"],
      correctAnswer: "React",
    },
    {
      id: 3,
      question: "What does JSX allow you to write in JavaScript?",
      options: ["SQL queries only", "HTML-like UI syntax", "Operating systems", "CSS files only"],
      correctAnswer: "HTML-like UI syntax",
    },
  ],
}) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => {
    const correct = questions.reduce(
      (total, question) => total + (answers[question.id] === question.correctAnswer ? 1 : 0),
      0
    );
    const total = questions.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    return {
      correct,
      total,
      percentage,
      passed: percentage >= passingPercentage,
    };
  }, [answers, questions, passingPercentage]);

  function chooseAnswer(questionId, option) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [questionId]: option }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  function tryAgain() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <main className="quiz-page">
      <style>{`
        .quiz-page { min-height: 100vh; box-sizing: border-box; padding: 32px 16px; background: #f3f6fb; color: #172033; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .quiz-card { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e1e7f0; border-radius: 18px; box-shadow: 0 12px 35px rgba(28, 42, 68, .08); overflow: hidden; }
        .quiz-header { padding: 24px 28px; background: #202938; color: #fff; }
        .quiz-header h1 { margin: 0 0 6px; font-size: 25px; }
        .quiz-header p { margin: 0; color: #cbd5e1; font-size: 14px; }
        .quiz-body { padding: 24px 28px 28px; }
        .quiz-question { padding: 18px 0; border-bottom: 1px solid #edf0f5; }
        .quiz-question:last-of-type { border-bottom: 0; }
        .quiz-question h2 { margin: 0 0 13px; font-size: 16px; line-height: 1.5; }
        .quiz-option { display: flex; gap: 10px; align-items: center; margin: 9px 0; padding: 11px 13px; border: 1px solid #dce3ed; border-radius: 10px; cursor: pointer; transition: background .15s, border-color .15s; }
        .quiz-option:hover { background: #f7f9fc; border-color: #9aa9bf; }
        .quiz-option.selected { background: #edf4ff; border-color: #3977d5; }
        .quiz-option input { accent-color: #2867c7; }
        .quiz-option.disabled { cursor: default; }
        .quiz-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        .quiz-button { border: 0; border-radius: 10px; padding: 12px 18px; font-size: 15px; font-weight: 700; cursor: pointer; }
        .quiz-button.primary { background: #2563eb; color: #fff; }
        .quiz-button.primary:disabled { opacity: .45; cursor: not-allowed; }
        .quiz-button.secondary { background: #e9eef6; color: #263449; }
        .quiz-result { margin-top: 22px; padding: 22px; border-radius: 14px; border: 1px solid; }
        .quiz-result.pass { background: #effbf3; border-color: #a8e2ba; }
        .quiz-result.fail { background: #fff3f1; border-color: #f2b6ae; }
        .quiz-result h2 { margin: 0 0 8px; font-size: 22px; }
        .quiz-result.pass h2 { color: #16743a; }
        .quiz-result.fail h2 { color: #b42318; }
        .quiz-score { display: flex; flex-wrap: wrap; gap: 10px 24px; margin-top: 14px; }
        .quiz-score span { color: #475569; font-size: 14px; }
        .quiz-score strong { display: block; color: #172033; font-size: 20px; margin-top: 3px; }
        .quiz-progress { height: 8px; border-radius: 99px; overflow: hidden; background: #e4e9f1; margin-top: 17px; }
        .quiz-progress > div { height: 100%; background: #2563eb; transition: width .25s; }
        .quiz-hint { color: #64748b; font-size: 13px; margin: 12px 0 0; }
        @media (max-width: 520px) { .quiz-page { padding: 14px 8px; } .quiz-header, .quiz-body { padding: 20px 17px; } .quiz-header h1 { font-size: 22px; } }
      `}</style>

      <section className="quiz-card">
        <header className="quiz-header">
          <h1>{title}</h1>
          <p>Answer all questions and submit to see your result immediately.</p>
        </header>

        <form className="quiz-body" onSubmit={handleSubmit}>
          {questions.map((question, index) => (
            <section className="quiz-question" key={question.id}>
              <h2>{index + 1}. {question.question}</h2>
              {question.options.map((option) => {
                const selected = answers[question.id] === option;
                return (
                  <label
                    className={`quiz-option${selected ? " selected" : ""}${submitted ? " disabled" : ""}`}
                    key={option}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={selected}
                      onChange={() => chooseAnswer(question.id, option)}
                      disabled={submitted}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </section>
          ))}

          {!submitted && (
            <>
              <p className="quiz-hint">
                Answered {Object.keys(answers).length} of {questions.length} questions. Passing score: {passingPercentage}%.
              </p>
              <div className="quiz-actions">
                <button className="quiz-button primary" type="submit" disabled={questions.length === 0}>
                  Submit quiz
                </button>
              </div>
            </>
          )}

          {submitted && (
            <section className={`quiz-result ${result.passed ? "pass" : "fail"}`} aria-live="polite" role="status">
              <h2>{result.passed ? "PASS — Congratulations!" : "FAIL — Keep practising"}</h2>
              <p>
                {result.passed
                  ? "You have achieved the required passing score."
                  : `You need at least ${passingPercentage}% to pass. Review the material and try again.`}
              </p>
              <div className="quiz-score">
                <div><span>Score</span><strong>{result.correct} / {result.total}</strong></div>
                <div><span>Percentage</span><strong>{result.percentage}%</strong></div>
                <div><span>Required to pass</span><strong>{passingPercentage}%</strong></div>
              </div>
              <div className="quiz-progress" aria-label={`Score: ${result.percentage}%`}>
                <div style={{ width: `${result.percentage}%` }} />
              </div>
              <div className="quiz-actions">
                <button className="quiz-button secondary" type="button" onClick={tryAgain}>
                  Try again
                </button>
              </div>
            </section>
          )}
        </form>
      </section>
    </main>
  );
}

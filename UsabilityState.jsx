import React from "react";

/*
 * Usability #20 - Clear system-state messages
 *
 * Example:
 * <UsabilityState state="notStarted" startTime="10:00 AM" />
 * <UsabilityState state="closed" />
 * <UsabilityState state="unavailable" />
 * <UsabilityState state="emptyLeaderboard" />
 * <UsabilityState state="loading" />
 * <UsabilityState state="error" onRetry={loadLeaderboard} />
 */

const STATE_CONTENT = {
  notStarted: {
    title: "Quiz has not started yet",
    message: "This quiz is not available yet. Please check back at the scheduled start time.",
    role: "status",
  },
  closed: {
    title: "Quiz is closed",
    message: "The submission window for this quiz has ended, so it can no longer be attempted.",
    role: "status",
  },
  unavailable: {
    title: "Quiz unavailable",
    message: "This quiz is currently unavailable. It may be unpublished or outside its scheduled time window.",
    role: "status",
  },
  emptyLeaderboard: {
    title: "No leaderboard results yet",
    message: "Scores will appear here after students complete and submit the quiz.",
    role: "status",
  },
  noAttempts: {
    title: "No attempts yet",
    message: "You have not attempted any quizzes yet. Available quizzes will appear in the quiz list.",
    role: "status",
  },
  loading: {
    title: "Loading",
    message: "Please wait while we load the information.",
    role: "status",
  },
  error: {
    title: "Something went wrong",
    message: "We could not load this information. Please try again.",
    role: "alert",
  },
};

export default function UsabilityState({
  state,
  startTime,
  onRetry,
  className = "",
}) {
  const content = STATE_CONTENT[state];

  if (!content) return null;

  const message =
    state === "notStarted" && startTime
      ? `This quiz is not available yet. It starts at ${startTime}. Please check back then.`
      : content.message;

  return (
    <section
      className={`usability-state ${className}`.trim()}
      role={content.role}
      aria-live={state === "error" ? "assertive" : "polite"}
      aria-busy={state === "loading"}
    >
      {state === "loading" && (
        <span className="usability-state__spinner" aria-hidden="true" />
      )}

      <h2 className="usability-state__title">{content.title}</h2>
      <p className="usability-state__message">{message}</p>

      {state === "error" && typeof onRetry === "function" && (
        <button
          className="usability-state__button"
          type="button"
          onClick={onRetry}
        >
          Try again
        </button>
      )}

      <style>{`
        .usability-state {
          box-sizing: border-box;
          width: 100%;
          padding: 24px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #ffffff;
          color: #000000;
          text-align: center;
        }
        .usability-state__title {
          margin: 0 0 8px;
          color: #000000;
          font-size: 1.15rem;
          font-weight: 600;
          line-height: 1.4;
        }
        .usability-state__message {
          margin: 0;
          color: #000000;
          font-size: 0.98rem;
          line-height: 1.6;
        }
        .usability-state__spinner {
          display: inline-block;
          width: 24px;
          height: 24px;
          margin-bottom: 12px;
          border: 3px solid #d1d5db;
          border-top-color: #000000;
          border-radius: 50%;
          animation: usability-state-spin 0.8s linear infinite;
        }
        .usability-state__button {
          margin-top: 16px;
          padding: 9px 16px;
          border: 1px solid #000000;
          border-radius: 6px;
          background: #ffffff;
          color: #000000;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        .usability-state__button:hover { background: #f3f4f6; }
        .usability-state__button:focus-visible {
          outline: 2px solid #000000;
          outline-offset: 3px;
        }
        @keyframes usability-state-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .usability-state__spinner { animation: none; }
        }
      `}</style>
    </section>
  );
}

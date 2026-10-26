import { useEffect, useRef, useState } from 'react';

// Drop-in replacement for components/Timer.jsx
// Put this file in frontend/src/components/QuizTimer.jsx
//
// What it does:
//  - counts down from the seconds the server sent (timeLeftSeconds)
//  - works out the time from an end time, so it stays correct when the tab is in background
//  - shows a progress bar and mm:ss (or h:mm:ss for long quizzes)
//  - changes colour at 5 minutes (yellow) and 1 minute (red), shows a short warning text
//  - calls onExpire() exactly once when it reaches 0 (use it to auto submit)
//
// The server is still the real authority on time (see backend attemptHelper.js),
// this is only what the student sees.

// ---------- hook ----------

export function useQuizTimer(initialSeconds, onExpire) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [total, setTotal] = useState(initialSeconds);

  // refs so the interval always calls the latest onExpire without restarting
  const onExpireRef = useRef(onExpire);
  const expiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    // null means the quiz is not loaded yet
    if (initialSeconds === null || initialSeconds === undefined) return;

    expiredRef.current = false;
    setTotal(initialSeconds);
    setTimeLeft(initialSeconds);

    const endsAt = Date.now() + initialSeconds * 1000;

    function tick() {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setTimeLeft(left);

      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(timer);
        onExpireRef.current && onExpireRef.current();
      }
    }

    const timer = setInterval(tick, 1000);
    tick(); // run once now so a refreshed page does not show an old value for 1 sec

    return () => clearInterval(timer);
  }, [initialSeconds]);

  return { timeLeft, total };
}

// ---------- helpers ----------

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}

// normal -> warning (<= 5 min) -> danger (<= 1 min)
function getLevel(seconds, total) {
  // for very short quizzes (e.g. 2 min) a 5 minute warning would be on from the start,
  // so the warning level is at most a quarter of the total time
  const warnAt = Math.min(300, Math.floor(total / 4));
  if (seconds <= 60) return 'danger';
  if (seconds <= warnAt) return 'warning';
  return 'normal';
}

const COLORS = {
  normal: '#2c3e8f', // same blue as .timer in index.css
  warning: '#d68910',
  danger: '#c0392b' // same red as .timer-low
};

const MESSAGES = {
  normal: '',
  warning: 'Less than 5 minutes left',
  danger: 'Less than 1 minute left - answers are saved automatically'
};

// ---------- component ----------

// props:
//   seconds  - time left in seconds from the server (null while loading)
//   onExpire - called once when time is over
export default function QuizTimer({ seconds, onExpire }) {
  const { timeLeft, total } = useQuizTimer(seconds, onExpire);

  if (seconds === null || seconds === undefined) {
    return null;
  }

  const level = getLevel(timeLeft, total);
  const color = COLORS[level];
  const percent = total > 0 ? Math.round((timeLeft / total) * 100) : 0;

  return (
    <div
      role="timer"
      aria-live={level === 'normal' ? 'off' : 'polite'}
      style={{ minWidth: '190px' }}
    >
      <div
        style={{
          background: color,
          color: 'white',
          padding: '8px 14px',
          borderRadius: '5px 5px 0 0',
          fontWeight: 'bold',
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          transition: 'background 0.3s'
        }}
      >
        <span>Time left</span>
        <span>{formatTime(timeLeft)}</span>
      </div>

      {/* bar shrinks as time goes */}
      <div style={{ height: '5px', background: '#d5d9e6', borderRadius: '0 0 5px 5px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: percent + '%',
            background: color,
            transition: 'width 1s linear, background 0.3s'
          }}
        />
      </div>

      {MESSAGES[level] && (
        <div style={{ fontSize: '12px', color, marginTop: '4px', fontWeight: 'bold' }}>
          {MESSAGES[level]}
        </div>
      )}
    </div>
  );
}

/*
  HOW TO USE in pages/AttemptQuiz.jsx
  -----------------------------------
  1. import QuizTimer from '../components/QuizTimer.jsx';

  2. replace  <Timer seconds={timeLeft} />  with

       <QuizTimer
         seconds={quiz.timeLeftSeconds}
         onExpire={() => submitQuiz(true)}
       />

  3. The old countdown useEffect in AttemptQuiz.jsx can be removed, but keep
     `timeLeft` state if you still use it for `locked`
     (const locked = submitting || timeLeft === 0). To keep that working
     without the old effect, change onExpire to:

       onExpire={() => { setTimeLeft(0); submitQuiz(true); }}

  Nothing changes in the backend: the deadline, the 30 sec grace time and the
  auto submit job stay the same.
*/

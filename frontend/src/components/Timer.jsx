// shows the time left as mm:ss (turns red in the last minute)
export default function Timer({ seconds }) {
  if (seconds === null) {
    return null;
  }

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const text = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  return (
    <div className={seconds <= 60 ? 'timer timer-low' : 'timer'}>
      Time left: {text}
    </div>
  );
}

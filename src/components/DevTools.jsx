import { useState } from 'react';
import { setFault, faults, resetDb } from '../services/storage.js';
import { setOnline, isOnline } from '../services/network.js';
import { shiftClock, clockOffset, now } from '../services/clock.js';
import { formatDateTime } from '../utils/format.js';

/**
 * Demo-only panel for exercising the alternative flows (offline, save failure, load failure, schedule changes).
 * Remove <DevTools /> from App.jsx before shipping a real product.
 */
export default function DevTools() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const off = clockOffset();
  const shift = (ms) => { shiftClock(ms); rerender(); };

  return (
    <div className="devtools">
      {open && (
        <div className="devtools-panel" role="dialog" aria-label="Test tools">
          <h4>Test tools</h4>
          <label><input type="checkbox" checked={!isOnline()} onChange={(e) => { setOnline(!e.target.checked); rerender(); }} /> Simulate offline</label>
          <label><input type="checkbox" checked={faults.failWrite} onChange={(e) => { setFault('failWrite', e.target.checked); rerender(); }} /> Simulate save failure</label>
          <label><input type="checkbox" checked={faults.failRead} onChange={(e) => { setFault('failRead', e.target.checked); rerender(); }} /> Simulate data load failure</label>
          <div className="dev-clock">
            <span>Clock: {formatDateTime(now())}{off ? ' (shifted)' : ''}</span>
            <div>
              <button onClick={() => shift(60000)}>+1 min</button>
              <button onClick={() => shift(3600000)}>+1 h</button>
              <button onClick={() => shift(86400000)}>+1 day</button>
              <button onClick={() => shift(-clockOffset())}>Reset</button>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm('Reset all demo data (quizzes, attempts, users)?')) { shiftClock(0); resetDb(); window.location.hash = '/login'; window.location.reload(); } }}>Reset demo data</button>
        </div>
      )}
      <button className="devtools-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Test tools'}{(!isOnline() || faults.failRead || faults.failWrite || off) && !open ? ' •' : ''}</button>
    </div>
  );
}

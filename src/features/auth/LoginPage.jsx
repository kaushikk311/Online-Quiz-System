import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { homeFor } from '../../services/auth.js';
import { navigate } from '../../router.js';
import { Button, Field, Notice } from '../../components/ui.jsx';

const DEMO = [
  ['Student · Alice', 'alice', 'student123'], ['Student · Bob', 'bob', 'student123'], ['Student · Dan', 'dan', 'student123'],
  ['Teacher', 'teacher', 'teacher123'], ['Admin', 'admin', 'admin123'],
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const r = signIn(form.username, form.password);
    if (r.ok) { navigate(homeFor(r.data.role)); return; }
    setErrors(r.errors || {});
    setFormError(r.code === 'MISSING' ? '' : r.error);
  };
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: undefined }); };

  return (
    <div className="login">
      <section className="login-hero">
        <div>
          <h1>Fill in the bubble. Know where you stand.</h1>
          <p>Timed quizzes, instant results and honest feedback for students, teachers and admins.</p>
        </div>
        <div className="omr-demo" aria-hidden="true">
          {['Create a quiz in minutes', 'Answers saved as you go', 'Results the moment you submit'].map((t, i) => (
            <div className="omr-row" key={t}>{['A', 'B', 'C'].map((l, j) => <span key={l} className={`bubble${i === j ? ' on' : ''}`}>{l}</span>)}<span>{t}</span></div>
          ))}
        </div>
      </section>
      <section className="login-form">
        <form onSubmit={submit} noValidate>
          <h2>Sign in</h2>
          <p className="muted">Use your school account to continue.</p>
          {formError && <Notice tone="error">{formError}</Notice>}
          <Field id="username" label="Username" error={errors.username}>
            <input id="username" type="text" autoComplete="username" value={form.username} onChange={set('username')} aria-invalid={!!errors.username} autoFocus />
          </Field>
          <Field id="password" label="Password" error={errors.password}>
            <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
          </Field>
          <Button type="submit">Sign in</Button>
          <div className="demo-accounts">
            <h4>Demo accounts</h4>
            <div className="chips">
              {DEMO.map(([label, u, p]) => <button type="button" key={u} className="chip" onClick={() => { setForm({ username: u, password: p }); setErrors({}); setFormError(''); }}>{label}</button>)}
            </div>
            <p className="hint">Tap a chip to fill the form, then sign in.</p>
          </div>
        </form>
      </section>
    </div>
  );
}

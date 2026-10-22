import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', 'POST', { email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.status ? err.message : 'Cannot connect to server');
      setLoading(false);
    }
  }

  return (
    <div className="auth-box">
      <h2>Login</h2>
      {location.state && location.state.msg && <p className="success">{location.state.msg}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p>New student? <Link to="/register">Register here</Link></p>

      <div className="demo-box">
        <b>Demo accounts</b>
        <p>admin@quiz.com / admin123</p>
        <p>teacher@quiz.com / teacher123</p>
        <p>student@quiz.com / student123</p>
      </div>
    </div>
  );
}

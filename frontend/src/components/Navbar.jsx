import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// links shown depend on the role of the user
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <span className="logo">Online Quiz System</span>

      <div className="nav-links">
        {user.role === 'ADMIN' && <Link to="/admin">Manage Users</Link>}
        {user.role === 'TEACHER' && <Link to="/teacher">Quizzes</Link>}
        {user.role === 'STUDENT' && <Link to="/student">My Quizzes</Link>}
        <Link to="/history">Attempt History</Link>
      </div>

      <div className="nav-user">
        <span>
          {user.name} <span className={'role-tag role-' + user.role.toLowerCase()}>{user.role}</span>
        </span>
        <button className="btn btn-light" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}

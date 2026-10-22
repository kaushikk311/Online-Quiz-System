import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// opens the page only if the user is logged in and has one of the allowed roles
// NOTE: this is only for the UI. the backend checks the role again on every request
export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
}

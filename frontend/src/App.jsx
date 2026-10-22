import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Unauthorized from './pages/Unauthorized.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import AttemptQuiz from './pages/AttemptQuiz.jsx';
import Result from './pages/Result.jsx';
import AttemptHistory from './pages/AttemptHistory.jsx';

// sends the user to their own dashboard based on role
function HomeRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'TEACHER') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route path="/admin" element={
            <ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/teacher" element={
            <ProtectedRoute roles={['TEACHER']}><TeacherDashboard /></ProtectedRoute>
          } />
          <Route path="/student" element={
            <ProtectedRoute roles={['STUDENT']}><StudentDashboard /></ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute roles={['STUDENT', 'TEACHER', 'ADMIN']}><AttemptHistory /></ProtectedRoute>
          } />
          <Route path="/attempt/:attemptId" element={
            <ProtectedRoute roles={['STUDENT']}><AttemptQuiz /></ProtectedRoute>
          } />
          <Route path="/result/:attemptId" element={
            <ProtectedRoute roles={['STUDENT', 'TEACHER', 'ADMIN']}><Result /></ProtectedRoute>
          } />

          <Route path="*" element={<p>Page not found</p>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

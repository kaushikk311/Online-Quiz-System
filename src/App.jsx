import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import DevTools from './components/DevTools.jsx';
import { AccessDenied } from './components/ui.jsx';
import { matchPath, navigate, usePath } from './router.js';
import { can, homeFor } from './services/auth.js';

import LoginPage from './features/auth/LoginPage.jsx';
import CategoryManagement from './features/categories/CategoryManagement.jsx';
import QuizManagement from './features/quizzes/QuizManagement.jsx';
import QuizEditor from './features/quizzes/QuizEditor.jsx';
import QuestionBank from './features/questions/QuestionBank.jsx';
import GenerateFromBook from './features/questions/GenerateFromBook.jsx';
import QuizList from './features/attempt/QuizList.jsx';
import QuizAttempt from './features/attempt/QuizAttempt.jsx';
import ResultScreen from './features/attempt/ResultScreen.jsx';
import AnswerReview from './features/review/AnswerReview.jsx';
import AttemptHistory from './features/history/AttemptHistory.jsx';
import Reports from './features/reports/Reports.jsx';
import Leaderboard from './features/leaderboard/Leaderboard.jsx';
import FeedbackPage from './features/feedback/FeedbackPage.jsx';

// Route table. `perm` is checked here (page level) and again inside every service (data level).
const ROUTES = [
  { path: '/quizzes', perm: 'quiz.attempt', render: () => <QuizList /> },
  { path: '/attempt/:quizId', perm: 'quiz.attempt', focus: true, render: (p) => <QuizAttempt key={p.quizId} quizId={p.quizId} /> },
  { path: '/result/:attemptId', perm: 'quiz.attempt', render: (p) => <ResultScreen attemptId={p.attemptId} /> },
  { path: '/review/:attemptId', perm: 'quiz.attempt', render: (p) => <AnswerReview attemptId={p.attemptId} /> },
  { path: '/history', perm: null, render: () => <AttemptHistory /> },
  { path: '/history/:userId', perm: null, render: (p) => <AttemptHistory userId={p.userId} /> },
  { path: '/feedback/:quizId', perm: 'feedback.view', render: (p) => <FeedbackPage quizId={p.quizId} /> },
  { path: '/leaderboard', perm: 'leaderboard.view', render: () => <Leaderboard /> },
  { path: '/leaderboard/:quizId', perm: 'leaderboard.view', render: (p) => <Leaderboard quizId={p.quizId} /> },
  { path: '/manage', perm: 'quiz.manage', render: () => <QuizManagement /> },
  { path: '/manage/new', perm: 'quiz.manage', render: () => <QuizEditor /> },
  { path: '/manage/:quizId', perm: 'quiz.manage', render: (p) => <QuizEditor key={p.quizId} quizId={p.quizId} /> },
  { path: '/questions', perm: 'question.manage', render: () => <QuestionBank /> },
  { path: '/questions/generate', perm: 'question.manage', render: () => <GenerateFromBook /> },
  { path: '/categories', perm: 'category.manage', render: () => <CategoryManagement /> },
  { path: '/reports', perm: 'report.view', render: () => <Reports /> },
];

function Router() {
  const path = usePath();
  const { user } = useAuth();

  useEffect(() => {
    if (!user && path !== '/login') navigate('/login');
    else if (user && (path === '/login' || path === '/' || path === '')) navigate(homeFor(user.role));
  }, [user, path]);

  if (!user) return <LoginPage />;
  if (path === '/login' || path === '/' || path === '') return null;

  for (const r of ROUTES) {
    const params = matchPath(r.path, path);
    if (!params) continue;
    const allowed = !r.perm || can(user, r.perm);
    return (
      <Layout path={path} focusMode={r.focus}>
        {allowed ? r.render(params) : <AccessDenied title="This page isn’t available for your role" message={`You’re signed in as ${user.role === 'admin' ? 'an admin' : `a ${user.role}`}, and this area is for a different role.`} backTo={homeFor(user.role)} backLabel="Go to my home page" />}
      </Layout>
    );
  }
  return <Layout path={path}><AccessDenied title="Page not found" message="That address doesn’t lead anywhere." backTo={homeFor(user.role)} backLabel="Go to my home page" /></Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router />
        <DevTools />
      </ToastProvider>
    </AuthProvider>
  );
}

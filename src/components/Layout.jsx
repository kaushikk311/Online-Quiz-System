import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../services/auth.js';
import { navigate } from '../router.js';
import { Badge } from './ui.jsx';
import QuizChatbot from '../features/chatbot/QuizChatbot.jsx';

const NAV = [
  { to: '/quizzes', label: 'Quizzes', perm: 'quiz.attempt', match: ['/quizzes', '/attempt', '/result', '/review'] },
  { to: '/history', label: 'My attempts', perm: 'quiz.attempt', match: ['/history'] },
  { to: '/manage', label: 'Quizzes', perm: 'quiz.manage', match: ['/manage'] },
  { to: '/questions', label: 'Question bank', perm: 'question.manage', match: ['/questions'] },
  { to: '/categories', label: 'Subjects', perm: 'category.manage', match: ['/categories'] },
  { to: '/reports', label: 'Reports', perm: 'report.view', match: ['/reports'] },
  { to: '/leaderboard', label: 'Leaderboard', perm: 'leaderboard.view', match: ['/leaderboard'] },
];

export default function Layout({ path, children, focusMode }) {
  const { user, signOut } = useAuth();
  const items = NAV.filter((n) => can(user, n.perm));
  const active = (n) => n.match.some((m) => path === m || path.startsWith(m + '/'));
  const tone = { admin: 'info', teacher: 'warn', student: 'neutral' }[user.role];

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Tickmark home"><span className="brand-bubble" aria-hidden="true" />Tickmark</a>
        {!focusMode && (
          <nav aria-label="Main">
            {items.map((n) => <a key={n.to} href={`#${n.to}`} className={active(n) ? 'active' : ''} aria-current={active(n) ? 'page' : undefined}>{n.label}</a>)}
          </nav>
        )}
        <div className="who">
          <span className="who-name">{user.name}</span>
          <Badge tone={tone}>{user.role}</Badge>
          {!focusMode && <button className="link-btn" onClick={() => { signOut(); navigate('/login'); }}>Sign out</button>}
        </div>
      </header>
      <main className={focusMode ? 'main main-focus' : 'main'}>{children}</main>
      {!focusMode && <QuizChatbot key={user.id} />}
    </div>
  );
}

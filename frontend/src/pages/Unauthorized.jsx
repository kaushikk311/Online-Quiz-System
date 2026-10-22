import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="card center">
      <h2>403 - Access Denied</h2>
      <p>You do not have permission to open this page.</p>
      <Link className="btn" to="/">Go to my dashboard</Link>
    </div>
  );
}

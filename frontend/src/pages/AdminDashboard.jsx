import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLES = ['ADMIN', 'TEACHER', 'STUDENT'];

// admin can see all users and change their role (#3)
export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [newRoles, setNewRoles] = useState({}); // userId -> selected role
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadUsers() {
    try {
      const data = await api('/admin/users');
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function saveRole(u) {
    setError('');
    setMessage('');
    try {
      const data = await api('/admin/users/' + u.id + '/role', 'PUT', { role: newRoles[u.id] });
      setMessage(data.user.name + ' is now ' + data.user.role);
      const copy = { ...newRoles };
      delete copy[u.id];
      setNewRoles(copy);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <p className="muted">Change user roles here. The user has to login again to get the new role.</p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const selected = newRoles[u.id] || u.role;
              const isMe = u.id === user.id;
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={selected}
                      disabled={isMe}
                      onChange={(e) => setNewRoles({ ...newRoles, [u.id]: e.target.value })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    {isMe ? (
                      <span className="muted">(you)</span>
                    ) : (
                      <button className="btn btn-small" disabled={selected === u.role} onClick={() => saveRole(u)}>
                        Save
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Other admin features</h3>
        <p className="muted">Subject categories (FR11) and class reports (#14) will be added here.</p>
      </div>
    </div>
  );
}

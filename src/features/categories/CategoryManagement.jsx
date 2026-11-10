import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useService } from '../../hooks/useService.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../../services/categories.js';
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, Notice, PageHeader } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

const blank = { name: '', description: '' };

/** FR11 / UC11 – Admin creates, updates and deletes subject categories. */
export default function CategoryManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const [res, reload] = useService(() => listCategories(user), [user.id]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const reset = () => { setForm(blank); setEditingId(null); setErrors({}); setFormError(''); };
  const save = (e) => {
    e.preventDefault();
    const r = editingId ? updateCategory(user, editingId, form) : createCategory(user, form);
    if (!r.ok) { setErrors(r.errors || {}); setFormError(r.errors && Object.keys(r.errors).length ? '' : r.error); return; }
    toast(editingId ? 'Subject updated' : 'Subject created');
    reset(); reload();
  };
  const remove = () => {
    const r = deleteCategory(user, confirm.id);
    if (!r.ok) { setDeleteError(r.error); return; }
    toast('Subject deleted'); setConfirm(null); setDeleteError(''); reload();
  };

  return (
    <>
      <PageHeader title="Subjects" subtitle="Organise quizzes and questions by subject. Teachers pick from this list." />
      <form className="sheet" onSubmit={save} noValidate>
        <h2>{editingId ? 'Edit subject' : 'New subject'}</h2>
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="grid-2">
          <Field id="cat-name" label="Name" error={errors.name}>
            <input id="cat-name" type="text" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: undefined }); }} aria-invalid={!!errors.name} />
          </Field>
          <Field id="cat-desc" label="Description (optional)" error={errors.description}>
            <input id="cat-desc" type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
        <div className="page-actions">
          <Button type="submit">{editingId ? 'Save changes' : 'Create subject'}</Button>
          {editingId && <Button variant="ghost" onClick={reset}>Cancel</Button>}
        </div>
      </form>

      {!res.ok ? <ErrorState message={res.error} onRetry={reload} /> : res.data.length === 0 ? (
        <EmptyState title="No subjects yet">Create your first subject above so teachers can assign quizzes to it.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Quizzes</th><th>Questions</th><th /></tr></thead>
            <tbody>
              {res.data.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong>{c.description && <span className="sub">{c.description}</span>}</td>
                  <td>{c.usage.quizzes}</td><td>{c.usage.questions}</td>
                  <td className="actions">
                    <Button variant="secondary" small onClick={() => { setEditingId(c.id); setForm({ name: c.name, description: c.description || '' }); setErrors({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button>
                    <Button variant="ghost" small onClick={() => { setConfirm(c); setDeleteError(''); }}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirm && <ConfirmDialog title={`Delete “${confirm.name}”?`} message="This removes the subject. Subjects used by quizzes or questions can’t be deleted." confirmLabel="Delete subject" tone="danger" error={deleteError} onConfirm={remove} onCancel={() => setConfirm(null)} />}
    </>
  );
}

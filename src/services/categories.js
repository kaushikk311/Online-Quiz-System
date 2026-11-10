import { readDb, updateDb } from './storage.js';
import { ok, fail, guard } from './result.js';
import { authorize } from './auth.js';
import { uid } from './clock.js';

function validate(db, input, selfId) {
  const e = {};
  const name = String(input.name ?? '').trim();
  if (!name) e.name = 'Enter a category name.';
  else if (name.length < 2) e.name = 'Name needs at least 2 characters.';
  else if (name.length > 40) e.name = 'Name can be at most 40 characters.';
  else if (db.categories.some((c) => c.id !== selfId && c.name.toLowerCase() === name.toLowerCase())) e.name = 'A category with this name already exists.';
  if (String(input.description ?? '').length > 200) e.description = 'Description can be at most 200 characters.';
  return e;
}

const usage = (db, id) => ({
  quizzes: db.quizzes.filter((q) => q.subjectId === id).length,
  questions: db.questions.filter((q) => q.categoryId === id).length,
});

export const listCategories = (actor) => guard(() => {
  const a = authorize(actor, 'category.view'); if (!a.ok) return a;
  const db = readDb();
  return ok(db.categories.map((c) => ({ ...c, usage: usage(db, c.id) })).sort((x, y) => x.name.localeCompare(y.name)));
});

export const createCategory = (actor, input) => guard(() => {
  const a = authorize(actor, 'category.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const errors = validate(db, input);
    if (Object.keys(errors).length) return fail('VALIDATION', 'Fix the highlighted fields.', errors);
    const c = { id: uid('c_'), name: input.name.trim(), description: String(input.description ?? '').trim() };
    db.categories.push(c);
    return ok(c);
  });
});

export const updateCategory = (actor, id, input) => guard(() => {
  const a = authorize(actor, 'category.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const c = db.categories.find((x) => x.id === id);
    if (!c) return fail('NOT_FOUND', 'This category no longer exists, so it was left unchanged.');
    const errors = validate(db, input, id);
    if (Object.keys(errors).length) return fail('VALIDATION', 'Fix the highlighted fields.', errors);
    c.name = input.name.trim();
    c.description = String(input.description ?? '').trim();
    return ok(c);
  });
});

export const deleteCategory = (actor, id) => guard(() => {
  const a = authorize(actor, 'category.manage'); if (!a.ok) return a;
  return updateDb((db) => {
    const c = db.categories.find((x) => x.id === id);
    if (!c) return fail('NOT_FOUND', 'This category no longer exists.');
    const u = usage(db, id);
    if (u.quizzes || u.questions) {
      const parts = [u.quizzes && `${u.quizzes} quiz${u.quizzes > 1 ? 'zes' : ''}`, u.questions && `${u.questions} question${u.questions > 1 ? 's' : ''}`].filter(Boolean).join(' and ');
      return fail('IN_USE', `“${c.name}” can’t be deleted because it is used by ${parts}. Move them to another category first — nothing was changed.`);
    }
    db.categories = db.categories.filter((x) => x.id !== id);
    return ok({ id });
  });
});

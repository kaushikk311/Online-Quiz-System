// tests for role based access (#3)
// these only check the role part, so database is not needed for these

process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

function makeToken(id, role) {
  return jwt.sign({ id, name: 'Test ' + role, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const admin = 'Bearer ' + makeToken(1, 'ADMIN');
const teacher = 'Bearer ' + makeToken(2, 'TEACHER');
const student = 'Bearer ' + makeToken(3, 'STUDENT');

describe('Not logged in', () => {
  test('no token gives 401', async () => {
    const res = await request(app).post('/api/quizzes');
    expect(res.statusCode).toBe(401);
  });

  test('wrong token gives 401', async () => {
    const res = await request(app).post('/api/quizzes').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.statusCode).toBe(401);
  });

  test('expired token gives 401', async () => {
    const old = jwt.sign({ id: 2, role: 'TEACHER' }, process.env.JWT_SECRET, { expiresIn: '-10s' });
    const res = await request(app).post('/api/quizzes').set('Authorization', 'Bearer ' + old);
    expect(res.statusCode).toBe(401);
  });

  test('token signed with some other secret gives 401', async () => {
    const fake = jwt.sign({ id: 3, role: 'ADMIN' }, 'hacker_secret');
    const res = await request(app).get('/api/admin/users').set('Authorization', 'Bearer ' + fake);
    expect(res.statusCode).toBe(401);
  });
});

describe('Quiz management (teacher only)', () => {
  test('teacher create quiz with no body gives 400', async () => {
    // real implementation now validates fields and returns 400 when they are missing
    const res = await request(app).post('/api/quizzes').set('Authorization', teacher);
    expect(res.statusCode).toBe(400);
  });

  test('student cannot create quiz', async () => {
    const res = await request(app).post('/api/quizzes').set('Authorization', student);
    expect(res.statusCode).toBe(403);
  });

  test('admin cannot create quiz', async () => {
    const res = await request(app).post('/api/quizzes').set('Authorization', admin);
    expect(res.statusCode).toBe(403);
  });

  test('student cannot change quiz schedule', async () => {
    const res = await request(app).put('/api/quizzes/1/schedule').set('Authorization', student);
    expect(res.statusCode).toBe(403);
  });

  test('student cannot delete quiz', async () => {
    const res = await request(app).delete('/api/quizzes/1').set('Authorization', student);
    expect(res.statusCode).toBe(403);
  });

  test('student cannot add questions', async () => {
    const res = await request(app).post('/api/quizzes/1/questions').set('Authorization', student);
    expect(res.statusCode).toBe(403);
  });
});

describe('Quiz attempt (student only)', () => {
  test('teacher cannot start a quiz attempt', async () => {
    const res = await request(app).post('/api/attempts/start/1').set('Authorization', teacher);
    expect(res.statusCode).toBe(403);
  });

  test('admin cannot submit a quiz attempt', async () => {
    const res = await request(app).post('/api/attempts/1/submit').set('Authorization', admin);
    expect(res.statusCode).toBe(403);
  });

  test('teacher cannot give feedback', async () => {
    const res = await request(app).post('/api/quizzes/1/feedback').set('Authorization', teacher);
    expect(res.statusCode).toBe(403);
  });

  test('student can give feedback', async () => {
    const res = await request(app).post('/api/quizzes/1/feedback').set('Authorization', student);
    expect(res.statusCode).toBe(200);
  });
});

describe('Attempt history (own data only)', () => {
  test('student cannot see another student history', async () => {
    const res = await request(app).get('/api/attempts/history/99').set('Authorization', student);
    expect(res.statusCode).toBe(403);
  });
});

describe('Categories (admin only)', () => {
  test('admin can create category', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', admin);
    expect(res.statusCode).toBe(200);
  });

  test('teacher cannot create category', async () => {
    const res = await request(app).post('/api/categories').set('Authorization', teacher);
    expect(res.statusCode).toBe(403);
  });

  test('everyone can see categories', async () => {
    for (const token of [admin, teacher, student]) {
      const res = await request(app).get('/api/categories').set('Authorization', token);
      expect(res.statusCode).toBe(200);
    }
  });
});

describe('Reports (admin and teacher)', () => {
  test('admin and teacher can see reports', async () => {
    for (const token of [admin, teacher]) {
      const res = await request(app).get('/api/reports/quiz/1').set('Authorization', token);
      expect(res.statusCode).toBe(200);
    }
  });

  test('student cannot see reports', async () => {
    const res = await request(app).get('/api/reports/student/3').set('Authorization', student);
    expect(res.statusCode).toBe(403);
  });
});

describe('Leaderboard (everyone)', () => {
  test('all roles can see leaderboard', async () => {
    for (const token of [admin, teacher, student]) {
      const res = await request(app).get('/api/leaderboard/1').set('Authorization', token);
      expect(res.statusCode).toBe(200);
    }
  });
});

describe('Admin routes', () => {
  test('teacher cannot see user list', async () => {
    const res = await request(app).get('/api/admin/users').set('Authorization', teacher);
    expect(res.statusCode).toBe(403);
  });

  test('student cannot change roles', async () => {
    const res = await request(app)
      .put('/api/admin/users/3/role')
      .set('Authorization', student)
      .send({ role: 'ADMIN' });
    expect(res.statusCode).toBe(403);
  });
});

describe('Register / login validation', () => {
  test('register without fields gives 400', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.statusCode).toBe(400);
  });

  test('register with bad email gives 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'a', email: 'abc', password: '123456' });
    expect(res.statusCode).toBe(400);
  });

  test('login without password gives 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.statusCode).toBe(400);
  });
});

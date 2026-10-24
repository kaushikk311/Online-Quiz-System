// tests for Quiz Feedback (#16)
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

function makeToken(id, role) {
  return jwt.sign({ id, name: 'Test ' + role, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const student = 'Bearer ' + makeToken(3, 'STUDENT');
const teacher = 'Bearer ' + makeToken(2, 'TEACHER');

describe('Quiz Feedback (#16)', () => {
  test('rejects feedback with invalid quiz id', async () => {
    const res = await request(app)
      .post('/api/quizzes/invalid/feedback')
      .set('Authorization', student)
      .send({ rating: 5 });
    expect(res.statusCode).toBe(400);
  });

  test('rejects feedback with invalid rating value', async () => {
    const res = await request(app)
      .post('/api/quizzes/1/feedback')
      .set('Authorization', student)
      .send({ rating: 10 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Rating must be an integer between 1 and 5/);
  });

  test('rejects feedback when rating is zero', async () => {
    const res = await request(app)
      .post('/api/quizzes/1/feedback')
      .set('Authorization', student)
      .send({ rating: 0 });
    expect(res.statusCode).toBe(400);
  });

  test('rejects non-student feedback submission', async () => {
    const res = await request(app)
      .post('/api/quizzes/1/feedback')
      .set('Authorization', teacher)
      .send({ rating: 5 });
    expect(res.statusCode).toBe(403);
  });
});

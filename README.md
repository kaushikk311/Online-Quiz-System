# Online Quiz System - Group 14

React (frontend) + Node.js / Express (backend) + PostgreSQL (database)

## Done so far

| Issue | What it does |
|---|---|
| #2 User authentication | Register / login with JWT token, passwords stored hashed (bcrypt) |
| #3 Role based access | ADMIN / TEACHER / STUDENT, role is checked on every API call and on the pages |
| #9 Auto and manual submission | Student can submit any time, quiz submits by itself when timer hits 0 |
| #10 Automatic evaluation | Answers checked against answer key, score + percentage + pass/fail |
| #11 Display results | Result page shown right after submitting |
| #19 Reliability | Autosave every 10 sec, retry on network failure, no double submit, transactions |

## How to run

**1. Database** - create a database called `quiz_system` in pgAdmin
(or in psql: `CREATE DATABASE quiz_system;`)

**2. Backend**
```
cd backend
npm install
copy .env.example .env      <- then put your postgres password in .env
npm run setup               <- creates tables + demo data
npm run dev                 <- runs on http://localhost:5000
```
Run tests with `npm test`

**3. Frontend** (in another terminal)
```
cd frontend
npm install
npm run dev                 <- open http://localhost:5173
```

## Demo logins

| Role | Email | Password |
|---|---|---|
| Admin | admin@quiz.com | admin123 |
| Teacher | teacher@quiz.com | teacher123 |
| Student | student@quiz.com | student123 |
| Student | student2@quiz.com | student123 |

"Operating Systems Quick Test" is only 1 minute, use it to see the auto submit.

## Who can do what

| Action | Admin | Teacher | Student |
|---|:-:|:-:|:-:|
| Change user roles | Yes | | |
| Manage categories | Yes | | |
| Create / update / delete / schedule quiz, add questions | | Yes | |
| Performance reports | Yes | Yes | |
| Attempt and submit quiz, give feedback | | | Yes |
| See result / attempt history | Yes | Yes | own only |
| Leaderboard | Yes | Yes | Yes |

New users who register are always STUDENT. Only the admin can make someone a teacher.
After the role is changed the user has to logout and login again.

## For the others

Use the middleware from `backend/src/middleware/auth.js` on your routes:
```js
router.post('/', authenticate, authorize(ROLES.TEACHER), createQuiz);
```
Routes for #4, #5, #6, #14, #15, #16 and categories are already there with the role check
(in `quizRoutes.js` and `otherRoutes.js`), just replace the code inside them.
Tables are in `backend/db/schema.sql`.

# Online Quiz System

A role-based online quiz platform built with **React** and **Vite**. Teachers and admins create and schedule quizzes, students take them against a timer and get instant results, and everyone gets analytics, leaderboards and feedback tools. The app runs entirely in the browser, so no backend or database is needed to try it.

## Features

### For students
- Browse quizzes with clear states (upcoming, open, closed, attempts used up)
- Take timed quizzes with auto-submit when time runs out
- Offline-safe submission: answers are queued if the connection drops
- Instant score with pass/fail result
- Review answers with the correct answer and explanation for each question
- Personal attempt history
- Leaderboard with a defined tie-break rule
- Rate a quiz you passed (1–5 stars, with an optional comment) and see its average rating

### For teachers
- Create, edit, filter and delete quizzes
- Schedule a start/end window, set time limit, pass percentage and attempt limit
- Optional shuffling of questions and answer options
- Optional penalty for unanswered questions
- Question bank with filters, supporting **multiple choice**, **true/false** and **fill-in-the-blank** questions
- Import questions from the bank into any quiz
- **Generate questions from a book:** upload a `.pdf`, `.txt` or `.md` file (or paste text) to get draft questions, then review and accept only the ones you want
- Class and student reports

### For admins
- Everything teachers can do
- Manage subjects (categories)

### For everyone
- **Quiz assistant:** a rule-based chatbot that answers questions about quiz times, attempts left, scores, ranks and how to use the system. It is hidden while a quiz is in progress and never reveals quiz answers.

## Tech stack

| Area | Tool |
|------|------|
| UI | React 18 |
| Build tool | Vite 5 |
| PDF reading | pdf.js (`pdfjs-dist`) |
| Storage | Browser `localStorage` |
| Routing | Lightweight hash-based router |

## Getting started

### Prerequisites
- Node.js 18 or newer
- npm

### Install and run

```bash
npm install
npm run dev
```

The app opens at <http://localhost:5173>.

### Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serves the production build locally
```

## Demo accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Teacher | `teacher` | `teacher123` |
| Student | `alice`, `bob`, `carol`, `dan` | `student123` |

Sign-in is per browser tab while data is shared across tabs, so you can open two tabs and use different roles at the same time.

## Project structure

```
src/
  App.jsx                 Route table and role-based page access
  main.jsx                App entry point
  router.js               Hash router
  styles.css              Global styles
  context/                Auth context
  components/             Layout, toast, shared UI, developer tools
  hooks/                  useService, useCountdown
  utils/                  Formatting helpers
  data/seed.js            Demo users, subjects, questions and quizzes
  features/
    auth/                 Sign-in
    quizzes/              Quiz list, editor, per-quiz questions, import from bank
    questions/            Question bank, question form, generate from book
    categories/           Subject management
    attempt/              Quiz list for students, attempt screen, result screen
    review/               Answer review
    history/              Attempt history
    reports/              Class and student analytics
    leaderboard/          Rankings
    feedback/             Ratings and comments
    chatbot/              Quiz assistant
  services/               Business rules (plain JavaScript)
                          auth, quizzes, questions, categories, attempts, scoring,
                          reports, leaderboard, feedback, chatbot, bookGenerator,
                          bookText, storage, clock, network, hash, result
```

Each feature folder holds the screens for one area, and all rules and data access live in `src/services/`, which keeps the UI thin. Permissions are checked both at the page level (in `App.jsx`) and again inside each service.

## Roles and access

| Area | Student | Teacher | Admin |
|------|:-------:|:-------:|:-----:|
| Take quizzes, results, review, history | ✓ | | |
| View leaderboard and feedback ratings | ✓ | ✓ | ✓ |
| Submit feedback on a quiz | ✓ | | |
| Manage quizzes | | ✓ | ✓ |
| Manage questions / generate from book | | ✓ | ✓ |
| Reports | | ✓ | ✓ |
| Manage subjects | | | ✓ |

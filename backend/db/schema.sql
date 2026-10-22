-- Online Quiz System - database tables
-- run using: npm run setup

-- users table (used for login #2 and role based access #3)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT role_check CHECK (role IN ('ADMIN', 'TEACHER', 'STUDENT'))
);

-- basic quiz table, columns taken from FR1 and FR10
-- (create/update quiz screens are part of #4, #5, #6)
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subject VARCHAR(100),
    time_limit_minutes INT NOT NULL CHECK (time_limit_minutes > 0),
    pass_percentage NUMERIC(5,2) NOT NULL CHECK (pass_percentage >= 0 AND pass_percentage <= 100),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_attempts INT NOT NULL DEFAULT 1 CHECK (max_attempts > 0),
    created_by INT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT window_check CHECK (end_time > start_time)
);

-- options is only used for MCQ (list of option texts)
-- for MCQ the correct_answer is the option text, not A/B/C/D
-- so it still works if options are shuffled later (FR9)
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL CHECK (question_type IN ('MCQ', 'TRUE_FALSE', 'FILL_BLANK')),
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    marks INT NOT NULL DEFAULT 1 CHECK (marks > 0)
);

-- one row for every time a student attempts a quiz
CREATE TABLE IF NOT EXISTS attempts (
    id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    submit_type VARCHAR(10) CHECK (submit_type IN ('MANUAL', 'AUTO')),
    score INT,
    total_marks INT,
    percentage NUMERIC(5,2),
    passed BOOLEAN
);

-- a student can have only one running attempt for a quiz at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_active_attempt
    ON attempts (quiz_id, student_id) WHERE status = 'IN_PROGRESS';

-- answers are saved while the student is doing the quiz (autosave)
-- so nothing is lost if internet goes off in between
CREATE TABLE IF NOT EXISTS attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    given_answer TEXT,
    is_correct BOOLEAN,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (attempt_id, question_id)
);

-- feedback given by students after completing a quiz (#16)
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (quiz_id, student_id)
);


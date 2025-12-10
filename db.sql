-- StuReflect PostgreSQL Schema
-- Updated: Courses can now have multiple teachers

-------------------------------------------------
-- ENUM TYPES
-------------------------------------------------
CREATE TYPE user_role AS ENUM ('student','teacher','admin');
CREATE TYPE reviewer_type AS ENUM ('ai','teacher');
CREATE TYPE feedback_severity AS ENUM ('low','medium','high','critical');

-------------------------------------------------
-- USER TABLE
-------------------------------------------------
CREATE TABLE "user" (
    id                 SERIAL PRIMARY KEY,
    email              VARCHAR(255) NOT NULL UNIQUE,
    name               VARCHAR(255) NOT NULL,
    github_id          VARCHAR(255),
    role               user_role NOT NULL DEFAULT 'student',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------------------------------
-- COURSE TABLE
-- Removed teacher_id (now many-to-many via course_teacher)
-------------------------------------------------
CREATE TABLE course (
    id                 SERIAL PRIMARY KEY,
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    join_code          VARCHAR(64) UNIQUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------------------------------
-- COURSE_TEACHER TABLE (NEW)
-- Allows multiple teachers per course
-------------------------------------------------
CREATE TABLE course_teacher (
    id                 SERIAL PRIMARY KEY,
    course_id          INT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    user_id            INT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, user_id)
);

-------------------------------------------------
-- COURSE SETTINGS (AI CONFIG)
-------------------------------------------------
CREATE TABLE course_settings (
    id                 SERIAL PRIMARY KEY,
    course_id          INT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    rubric             TEXT,
    ai_guidelines      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------------------------------
-- ENROLLMENT TABLE
-------------------------------------------------
CREATE TABLE enrollment (
    id                 SERIAL PRIMARY KEY,
    course_id          INT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    user_id            INT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, user_id)
);

-------------------------------------------------
-- ASSIGNMENT TABLE
-------------------------------------------------
CREATE TABLE assignment (
    id                 SERIAL PRIMARY KEY,
    title              VARCHAR(255) NOT NULL,
    description        TEXT,
    course_id          INT NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    due_date           TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------------------------------
-- SUBMISSION TABLE
-------------------------------------------------
CREATE TABLE submission (
    id                 SERIAL PRIMARY KEY,
    assignment_id      INT NOT NULL REFERENCES assignment(id) ON DELETE CASCADE,
    user_id            INT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    github_url         VARCHAR(2048),
    commit_sha         VARCHAR(128),
    status             VARCHAR(50) NOT NULL DEFAULT 'pending',
    ai_score           INT CHECK (ai_score BETWEEN 0 AND 100),
    manual_score       INT CHECK (manual_score BETWEEN 0 AND 100),
    webhook_id         VARCHAR(255),
    webhook_secret     VARCHAR(255),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(assignment_id, user_id, commit_sha)
);

-------------------------------------------------
-- FEEDBACK TABLE
-------------------------------------------------
CREATE TABLE feedback (
    id                 SERIAL PRIMARY KEY,
    submission_id      INT NOT NULL REFERENCES submission(id) ON DELETE CASCADE,
    content            TEXT NOT NULL,
    reviewer           reviewer_type NOT NULL DEFAULT 'ai',
    severity           feedback_severity NOT NULL DEFAULT 'low',
    line_number        INT,
    suggestion         TEXT,
    type               VARCHAR(128),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
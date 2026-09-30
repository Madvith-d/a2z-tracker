-- Additive: existing accounts and solved progress are untouched.
CREATE TABLE practice_attempts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  practiced_on DATE NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('struggled', 'with-help', 'independent')),
  duration_minutes INTEGER CHECK (duration_minutes BETWEEN 1 AND 1440),
  confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  approach TEXT NOT NULL DEFAULT '' CHECK (length(approach) <= 4000),
  mistakes TEXT NOT NULL DEFAULT '' CHECK (length(mistakes) <= 4000),
  next_review_on DATE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (next_review_on IS NULL OR next_review_on >= practiced_on)
);
CREATE INDEX practice_attempts_user_history ON practice_attempts
  (user_id, practiced_on DESC, created_at DESC, id DESC);
CREATE INDEX practice_attempts_user_problem ON practice_attempts
  (user_id, problem_id, practiced_on DESC, created_at DESC);

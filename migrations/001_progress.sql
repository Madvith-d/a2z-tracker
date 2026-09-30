CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL
);

-- Presence means solved. The composite key isolates users and makes repeated
-- solve requests idempotent; unsolving deletes only the caller's row.
CREATE TABLE problem_progress (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  solved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, problem_id)
);

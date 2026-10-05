-- User-owned problems can be journaled without becoming roadmap progress items.
ALTER TABLE problems
  ADD COLUMN user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  ADD COLUMN problem_link TEXT;

ALTER TABLE problems
  ADD CONSTRAINT custom_problem_link_required CHECK (
    user_id IS NULL OR (problem_link IS NOT NULL AND length(problem_link) BETWEEN 1 AND 2048)
  );

CREATE INDEX problems_user_custom ON problems (user_id, title) WHERE user_id IS NOT NULL;

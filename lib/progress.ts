import { db } from "./db";
import { problemIds } from "./roadmap";

export async function getSolvedIds(userId: string): Promise<string[]> {
  const result = await db.query<{ problem_id: string }>(
    "SELECT problem_id FROM problem_progress WHERE user_id = $1 ORDER BY problem_id",
    [userId],
  );
  return result.rows.map((row) => row.problem_id).filter((id) => problemIds.has(id));
}

export async function setSolved(userId: string, problemId: string, solved: boolean) {
  if (solved) {
    await db.query(
      `INSERT INTO problem_progress (user_id, problem_id) VALUES ($1, $2)
       ON CONFLICT (user_id, problem_id) DO NOTHING`,
      [userId, problemId],
    );
  } else {
    await db.query("DELETE FROM problem_progress WHERE user_id = $1 AND problem_id = $2", [userId, problemId]);
  }
}

export async function importSolved(userId: string, ids: string[]) {
  // One atomic, additive operation: imports cannot unset existing progress.
  await db.query(
    `INSERT INTO problem_progress (user_id, problem_id)
     SELECT $1, unnest($2::text[]) ON CONFLICT (user_id, problem_id) DO NOTHING`,
    [userId, ids],
  );
}

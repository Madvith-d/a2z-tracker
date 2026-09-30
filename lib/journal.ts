import { db } from "./db";
import { HttpError } from "./api";
import type { Attempt, AttemptFields } from "./journal-schema";

const columns = `id, problem_id AS "problemId", practiced_on::text AS "practicedOn", outcome,
  duration_minutes AS "durationMinutes", confidence, approach, mistakes,
  next_review_on::text AS "nextReviewOn", version,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"`;

export async function getAttempts(userId: string): Promise<Attempt[]> {
  const result = await db.query<Attempt>(`SELECT ${columns} FROM practice_attempts WHERE user_id = $1
    ORDER BY practiced_on DESC, created_at DESC, id DESC`, [userId]);
  return result.rows;
}
function values(data: AttemptFields) {
  return [data.problemId, data.practicedOn, data.outcome, data.durationMinutes, data.confidence, data.approach, data.mistakes, data.nextReviewOn];
}
export async function createAttempt(userId: string, id: string, data: AttemptFields) {
  const result = await db.query<Attempt>(`INSERT INTO practice_attempts
    (user_id, id, problem_id, practiced_on, outcome, duration_minutes, confidence, approach, mistakes, next_review_on)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING RETURNING ${columns}`, [userId, id, ...values(data)]);
  if (result.rows[0]) return result.rows[0];
  // Retrying a POST after a lost response is idempotent, never a second attempt.
  const existing = await db.query<Attempt>(`SELECT ${columns} FROM practice_attempts WHERE user_id=$1 AND id=$2`, [userId, id]);
  const attempt = existing.rows[0];
  if (!attempt || Object.keys(data).some((key) => key in attempt && data[key as keyof AttemptFields] !== attempt[key as keyof AttemptFields])) {
    throw new HttpError(409, "This attempt ID is already in use. Reload the journal before trying again.");
  }
  return attempt;
}
export async function updateAttempt(userId: string, id: string, version: number, data: AttemptFields) {
  const result = await db.query<Attempt>(`UPDATE practice_attempts SET problem_id=$3, practiced_on=$4,
    outcome=$5, duration_minutes=$6, confidence=$7, approach=$8, mistakes=$9, next_review_on=$10,
    version=version+1, updated_at=now() WHERE user_id=$1 AND id=$2 AND version=$11 RETURNING ${columns}`,
  [userId, id, ...values(data), version]);
  if (!result.rows[0]) await missingOrStale(userId, id);
  return result.rows[0];
}
async function missingOrStale(userId: string, id: string): Promise<never> {
  const exists = await db.query("SELECT 1 FROM practice_attempts WHERE user_id=$1 AND id=$2", [userId, id]);
  if (!exists.rowCount) throw new HttpError(404, "Attempt not found.");
  throw new HttpError(409, "This attempt changed in another tab. Keep a copy of your notes, then reload before editing again.");
}
export async function clearRevision(userId: string, id: string, version: number) {
  const result = await db.query<Attempt>(`UPDATE practice_attempts SET next_review_on=NULL,
    version=version+1, updated_at=now() WHERE user_id=$1 AND id=$2 AND version=$3 RETURNING ${columns}`, [userId, id, version]);
  if (!result.rows[0]) await missingOrStale(userId, id);
  return result.rows[0];
}
export async function deleteAttempt(userId: string, id: string, version: number) {
  const result = await db.query("DELETE FROM practice_attempts WHERE user_id=$1 AND id=$2 AND version=$3", [userId, id, version]);
  if (!result.rowCount) await missingOrStale(userId, id);
  return { deleted: true };
}

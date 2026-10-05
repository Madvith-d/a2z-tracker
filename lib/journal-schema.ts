import { z } from "zod";

// ISO date validation rejects impossible dates (including invalid leap days).
const calendarDate = z.iso.date().refine((value) => value >= "1900-01-01" && value <= "2100-12-31", "Use a date between 1900 and 2100.");
export const attemptFields = z.object({
  problemId: z.string().min(1).max(200),
  practicedOn: calendarDate,
  outcome: z.enum(["struggled", "with-help", "independent"]),
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  confidence: z.number().int().min(1).max(5),
  approach: z.string().max(4000),
  mistakes: z.string().max(4000),
  nextReviewOn: calendarDate.nullable(),
}).strict();
const reviewAfterPractice = (value: z.infer<typeof attemptFields>) => !value.nextReviewOn || value.nextReviewOn >= value.practicedOn;
export const createAttemptSchema = attemptFields.extend({ id: z.uuid() }).strict()
  .refine(reviewAfterPractice, { message: "Revision date must be on or after the practice date.", path: ["nextReviewOn"] });
export const customProblemSchema = z.object({
  title: z.string().trim().min(1, "Enter a problem name.").max(200),
  link: z.url("Enter a valid problem link.").max(2048).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Use an http or https link."),
}).strict();
export const createAttemptRequestSchema = z.object({
  id: z.uuid(),
  ...attemptFields.shape,
  customProblem: customProblemSchema.nullish(),
}).strict()
  .refine(reviewAfterPractice, { message: "Revision date must be on or after the practice date.", path: ["nextReviewOn"] })
  .refine((value) => !value.customProblem || z.uuid().safeParse(value.problemId).success, {
    message: "Invalid custom problem ID.", path: ["problemId"],
  });
export const updateAttemptSchema = attemptFields.extend({ version: z.number().int().positive() }).strict()
  .refine(reviewAfterPractice, { message: "Revision date must be on or after the practice date.", path: ["nextReviewOn"] });
export const versionSchema = z.object({ version: z.number().int().positive() }).strict();
export type AttemptFields = z.infer<typeof attemptFields>;
export type Attempt = AttemptFields & { id: string; version: number; createdAt: string; updatedAt: string };
export const outcomeLabels: Record<AttemptFields["outcome"], string> = {
  struggled: "Still working on it", "with-help": "Solved with help", independent: "Solved independently",
};
export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function latestAttempts(attempts: Attempt[]) {
  const latest = new Map<string, Attempt>();
  // Never depend on fetch order or insertion order after editing a date.
  for (const attempt of [...attempts].sort((a, b) => b.practicedOn.localeCompare(a.practicedOn) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))) {
    if (!latest.has(attempt.problemId)) latest.set(attempt.problemId, attempt);
  }
  return [...latest.values()];
}

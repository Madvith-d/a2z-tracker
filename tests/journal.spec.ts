import { test, expect } from "@playwright/test";
import { createAttemptRequestSchema, createAttemptSchema, customProblemSchema, latestAttempts, type Attempt } from "../lib/journal-schema";

const base: Attempt = {
  id: "2e5db9eb-c67e-4772-85af-1c3589c12c1a", problemId: "srinpttpt", practicedOn: "2026-01-10",
  outcome: "independent", durationMinutes: null, confidence: 4, approach: "", mistakes: "",
  nextReviewOn: "2026-01-15", version: 1, createdAt: "2026-01-10T12:00:00.000000Z", updatedAt: "2026-01-10T12:00:00.000000Z",
};
test("revision queue uses practice date, not insertion or update order", () => {
  const backdated = { ...base, id: "backdated", practicedOn: "2026-01-01", createdAt: "2026-01-20T12:00:00.000000Z" };
  const retry = { ...base, id: "retry", practicedOn: "2026-01-11", nextReviewOn: null };
  expect(latestAttempts([backdated, base])).toEqual([base]);
  expect(latestAttempts([base, backdated])).toEqual([base]);
  expect(latestAttempts([base, retry, backdated])).toEqual([retry]);
  const sameDay = { ...base, id: "same-day", createdAt: "2026-01-10T12:00:00.000001Z" };
  expect(latestAttempts([base, sameDay])).toEqual([sameDay]);
  const tie = { ...base, id: "z" };
  expect(latestAttempts([base, tie])).toEqual([tie]);
  const editedOlder = { ...backdated, updatedAt: "2026-01-30T12:00:00.000000Z" };
  expect(latestAttempts([editedOlder, base])).toEqual([base]);
  expect(latestAttempts([base, { ...base, id: "different", problemId: "dttyps" }])).toHaveLength(2);
});
test("custom problems require a name and an http(s) problem link", () => {
  expect(customProblemSchema.safeParse({ title: "Merge Intervals", link: "https://leetcode.com/problems/merge-intervals/" }).success).toBe(true);
  expect(customProblemSchema.safeParse({ title: " ", link: "https://example.com" }).success).toBe(false);
  expect(customProblemSchema.safeParse({ title: "Problem", link: "javascript:alert(1)" }).success).toBe(false);
  const { version: _version, createdAt: _createdAt, updatedAt: _updatedAt, ...request } = base;
  void _version; void _createdAt; void _updatedAt;
  expect(createAttemptRequestSchema.safeParse({ ...request, problemId: "97208280-b008-442b-b3ac-4a63ed5fbb5f", customProblem: { title: "Problem", link: "https://example.com/problem" } }).success).toBe(true);
  expect(createAttemptRequestSchema.safeParse({ ...request, problemId: "not-a-uuid", customProblem: { title: "Problem", link: "https://example.com/problem" } }).success).toBe(false);
});
test("calendar validation respects leap years and revision boundaries", () => {
  const { version: _v, createdAt: _c, updatedAt: _u, ...fields } = base;
  void _v; void _c; void _u;
  expect(createAttemptSchema.safeParse({ ...fields, practicedOn: "2024-02-29" }).success).toBe(true);
  for (const practicedOn of ["2025-02-29", "2026-04-31", "1899-12-31", "2101-01-01", "2026-1-1"]) {
    expect(createAttemptSchema.safeParse({ ...fields, practicedOn }).success).toBe(false);
  }
  expect(createAttemptSchema.safeParse({ ...fields, nextReviewOn: "2026-01-09" }).success).toBe(false);
  expect(createAttemptSchema.safeParse({ ...fields, nextReviewOn: fields.practicedOn }).success).toBe(true);
  expect(createAttemptSchema.safeParse({ ...fields, nextReviewOn: null }).success).toBe(true);
});

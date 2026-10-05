import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import AxeBuilder from "@axe-core/playwright";
import source from "../a2z.json";
import type { Step } from "../lib/roadmap";

const origin = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const password = "A-unique-test-passphrase-2026!";
const emails: string[] = [];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
function email() {
  const value = `a2z-test-${randomUUID()}@example.com`;
  emails.push(value);
  return value;
}

test.afterAll(async () => {
  // Delete only accounts created by this test worker. FK cascades remove their
  // sessions, credentials, and progress; never clear a developer's database.
  await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [emails]);
  await pool.end();
});

test("curriculum IDs are unique and all 455 problems are preserved", () => {
  const steps: Step[] = source;
  const topics = steps.flatMap((step) => step.sub_steps.flatMap((sub) => sub.topics));
  expect(source).toHaveLength(18);
  expect(topics).toHaveLength(455);
  expect(new Set(topics.map((topic) => topic.id)).size).toBe(topics.length);
});

test("guests can browse and search but cannot save progress", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A2Z DSA Course Roadmap" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("searchbox").fill("User Input / Output");
  await expect(page.getByRole("checkbox", { name: "Mark User Input / Output solved" })).toBeDisabled();
  expect((await request.get("/api/progress")).status()).toBe(401);
  expect((await request.put("/api/progress", {
    headers: { origin }, data: { problemId: "srinpttpt", solved: true },
  })).status()).toBe(401);
  expect((await request.post("/api/progress/import", {
    headers: { origin }, data: { problemIds: ["srinpttpt"] },
  })).status()).toBe(401);
  expect((await request.get("/api/journal")).status()).toBe(401);
  expect((await request.post("/api/journal", { headers: { origin }, data: {} })).status()).toBe(401);
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/a2z-roadmap-${width}.png`, fullPage: true });
  }
});

test("registration, saving, reload, sign-in, import, rollback and unsolve", async ({ page }) => {
  const userEmail = email();
  await page.goto("/sign-up");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Name", { exact: true }).fill("Test Learner");
  await page.getByLabel("Email", { exact: true }).fill(userEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("0 / 455 solved", { exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name.includes("session_token"));
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");

  await page.getByRole("searchbox").fill("User Input / Output");
  const checkbox = page.getByRole("checkbox", { name: "Mark User Input / Output solved" });
  await checkbox.check();
  await expect(page.getByRole("status")).toHaveText("Progress saved.");
  await expect(page.getByText("1 / 455 solved", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("searchbox").fill("User Input / Output");
  await expect(checkbox).toBeChecked();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(userEmail);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".error-message[role=alert]")).toContainText("Unable to sign in");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("1 / 455 solved", { exact: true })).toBeVisible();

  await page.evaluate(() => localStorage.setItem("dsaRoadmapProgress", JSON.stringify({ dttyps: true, srinpttpt: false, "unknown-id": true })));
  await page.getByText("Bring over progress from the old sheet").click();
  await page.getByRole("button", { name: "Import browser progress" }).click();
  await expect(page.getByText("2 / 455 solved", { exact: true })).toBeVisible();
  await page.getByLabel("Import JSON file").setInputFiles({
    name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ iflssttmnts: true })),
  });
  await expect(page.getByText("3 / 455 solved", { exact: true })).toBeVisible();

  await page.getByRole("searchbox").fill("User Input / Output");
  await page.route("**/api/progress", (route) => route.request().method() === "PUT"
    ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Test save failed." }) })
    : route.continue());
  await checkbox.uncheck();
  await expect(page.locator(".error-message[role=alert]")).toContainText("Test save failed.");
  await expect(checkbox).toBeChecked();
  await page.unroute("**/api/progress");
  await checkbox.uncheck();
  await expect(page.getByRole("status")).toHaveText("Progress saved.");
  await page.reload();
  await page.getByRole("searchbox").fill("User Input / Output");
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByText("2 / 455 solved", { exact: true })).toBeVisible();

  // Journal attempts never change the independent solved status.
  await page.getByRole("link", { name: "Journal for User Input / Output" }).click();
  await expect(page.getByRole("heading", { name: "Practice journal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log attempt", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Time spent (minutes)").fill("25");
  await dialog.getByRole("combobox", { name: "Outcome", exact: true }).selectOption("with-help");
  await page.getByLabel("Approach & notes").fill("Read the input once, then format the output.");
  await page.getByLabel("Mistakes & takeaways").fill("Remember whitespace and newline handling.");
  await page.getByLabel("Practice date").fill("2026-01-01");
  await page.getByLabel("Next revision (optional)").fill("2026-01-02");
  await page.route("**/api/journal", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Test journal failure." }) })
    : route.continue());
  await dialog.getByRole("button", { name: "Save attempt" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Your notes are still here");
  await expect(page.getByLabel("Approach & notes")).toHaveValue("Read the input once, then format the output.");
  await page.unroute("**/api/journal");
  await dialog.getByRole("button", { name: "Save attempt" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Attempt saved.");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await page.getByText("Read notes", { exact: true }).click();
  await expect(page.getByText("Remember whitespace and newline handling.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Confidence", exact: true }).selectOption("4");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Confidence 4/5")).toBeVisible();

  await page.getByRole("button", { name: /Revision queue/ }).click();
  await expect(page.getByText("Due for revision", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Log retry" }).click();
  await page.getByLabel("Practice date").fill("2026-01-03");
  await dialog.getByRole("combobox", { name: "Outcome", exact: true }).selectOption("independent");
  await page.getByRole("button", { name: "Save attempt" }).click();
  await expect(page.getByRole("heading", { name: "No revisions scheduled." })).toBeVisible();
  await page.getByRole("button", { name: /Attempt history/ }).click();
  await expect(page.locator(".attempt-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await page.getByRole("button", { name: "Keep attempt" }).click();
  await expect(page.locator(".attempt-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.locator(".attempt-row")).toHaveCount(1);
  await page.getByRole("button", { name: /Revision queue/ }).click();
  await expect(page.locator(".attempt-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear reminder" }).click();
  await expect(page.getByRole("heading", { name: "No revisions scheduled." })).toBeVisible();
  await page.reload();
  await expect(page.locator(".attempt-row")).toHaveCount(1);
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/a2z-journal-${width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "/tmp/a2z-attempt-mobile.png", fullPage: true });
  await page.getByLabel("Approach & notes").fill("Unsaved local note");
  page.once("dialog", (confirmation) => confirmation.dismiss());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Simulate a newer write from another tab while this draft remains open.
  const all = await (await page.request.get("/api/journal")).json();
  const currentAttempt = all.attempts[0];
  expect((await page.request.patch(`/api/journal/${currentAttempt.id}`, { headers: { origin }, data: { version: currentAttempt.version } })).ok()).toBe(true);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText("changed in another tab");
  await expect(page.getByLabel("Approach & notes")).toHaveValue("Unsaved local note");
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/");
  await expect(page.getByText("2 / 455 solved", { exact: true })).toBeVisible();

  const stored = await pool.query(`SELECT a.password FROM account a JOIN "user" u ON a."userId" = u.id WHERE u.email = $1`, [userEmail]);
  expect(stored.rows[0].password).not.toBe(password);
  expect(stored.rows[0].password.length).toBeGreaterThan(64);
});

test("API validates ownership, origins, input, duplicate writes and revoked sessions", async ({ playwright }) => {
  const a = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { origin } });
  const b = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { origin } });
  try {
    const weakPassword = await a.post("/api/auth/sign-up/email", { data: { name: "Weak Password", email: email(), password: "short" } });
    expect(weakPassword.status()).toBe(400);
    for (const client of [a, b]) {
      const response = await client.post("/api/auth/sign-up/email", { data: { name: "API Learner", email: email(), password } });
      expect(response.ok(), await response.text()).toBe(true);
    }
    for (let i = 0; i < 2; i++) {
      expect((await a.put("/api/progress", { data: { problemId: "srinpttpt", solved: true } })).ok()).toBe(true);
    }
    expect(await (await a.get("/api/progress")).json()).toEqual({ solvedIds: ["srinpttpt"] });
    expect(await (await b.get("/api/progress")).json()).toEqual({ solvedIds: [] });
    await b.put("/api/progress", { data: { problemId: "srinpttpt", solved: false } });
    expect(await (await a.get("/api/progress")).json()).toEqual({ solvedIds: ["srinpttpt"] });

    const badBodies = [
      { problemId: "not-a-real-problem", solved: true },
      { problemId: "srinpttpt", solved: "true" },
      { problemId: "srinpttpt", solved: false, userId: "someone-else" },
    ];
    for (const data of badBodies) expect((await a.put("/api/progress", { data })).status()).toBe(400);
    expect((await a.put("/api/progress", { headers: { origin: "https://evil.example" }, data: { problemId: "srinpttpt", solved: false } })).status()).toBe(403);
    expect((await a.put("/api/progress", { headers: { origin: "" }, data: { problemId: "srinpttpt", solved: false } })).status()).toBe(403);
    expect((await a.put("/api/progress", { headers: { "Content-Type": "application/json" }, data: "{invalid" })).status()).toBe(400);
    expect((await a.post("/api/progress/import", { data: { problemIds: ["dttyps", "unknown"] } })).status()).toBe(400);
    expect(await (await a.get("/api/progress")).json()).toEqual({ solvedIds: ["srinpttpt"] });
    expect((await a.post("/api/progress/import", { data: { problemIds: ["dttyps", "dttyps"] } })).ok()).toBe(true);
    expect((await (await a.get("/api/progress")).json()).solvedIds).toEqual(["dttyps", "srinpttpt"]);

    const payload = {
      id: randomUUID(), problemId: "srinpttpt", practicedOn: "2026-01-01", outcome: "with-help",
      durationMinutes: 25, confidence: 3, approach: "Use one pass.", mistakes: "Check empty input.", nextReviewOn: "2026-01-05",
    };
    const created = await a.post("/api/journal", { data: payload });
    expect(created.ok(), await created.text()).toBe(true);
    const entry = (await created.json()).attempt;
    expect(entry.version).toBe(1);
    expect(entry.practicedOn).toBe("2026-01-01");
    expect((await a.post("/api/journal", { data: payload })).ok()).toBe(true);
    expect((await (await a.get("/api/journal")).json()).attempts).toHaveLength(1);
    expect((await (await b.get("/api/journal")).json()).attempts).toEqual([]);
    const { id: _id, ...fields } = payload;
    void _id;
    expect((await b.put(`/api/journal/${entry.id}`, { data: { ...fields, version: 1 } })).status()).toBe(404);
    expect((await b.patch(`/api/journal/${entry.id}`, { data: { version: 1 } })).status()).toBe(404);
    expect((await b.delete(`/api/journal/${entry.id}`, { data: { version: 1 } })).status()).toBe(404);
    expect((await b.post("/api/journal", { data: payload })).status()).toBe(409);
    for (const data of [
      { ...payload, problemId: "unknown" }, { ...payload, userId: "other-user" },
      { ...payload, confidence: 6 }, { ...payload, durationMinutes: -1 }, { ...payload, durationMinutes: 1.5 },
      { ...payload, practicedOn: "2026-02-30" }, { ...payload, nextReviewOn: "2025-12-31" },
      { ...payload, approach: "x".repeat(4001) }, { ...payload, outcome: "unknown" },
    ]) expect((await a.post("/api/journal", { data })).status()).toBe(400);
    expect((await a.post("/api/journal", { headers: { origin: "https://evil.example" }, data: payload })).status()).toBe(403);
    expect((await a.post("/api/journal", { headers: { origin: "" }, data: payload })).status()).toBe(403);
    expect((await a.post("/api/journal", { data: { ...payload, approach: "x".repeat(21000) } })).status()).toBe(413);
    const updated = await a.put(`/api/journal/${entry.id}`, { data: { ...fields, confidence: 5, version: 1 } });
    expect(updated.ok()).toBe(true);
    expect((await updated.json()).attempt.version).toBe(2);
    expect((await a.put(`/api/journal/${entry.id}`, { data: { ...fields, version: 1 } })).status()).toBe(409);
    expect((await a.delete(`/api/journal/${entry.id}`, { data: { version: 1 } })).status()).toBe(409);
    expect((await a.patch(`/api/journal/${entry.id}`, { data: { version: 2 } })).ok()).toBe(true);
    const persisted = (await (await a.get("/api/journal")).json()).attempts[0];
    expect(persisted.nextReviewOn).toBeNull();
    expect(persisted.confidence).toBe(5);
    expect((await a.delete(`/api/journal/${entry.id}`, { data: { version: 3 } })).ok()).toBe(true);
    expect((await (await a.get("/api/journal")).json()).attempts).toEqual([]);

    const customPayload = {
      ...payload, id: randomUUID(), problemId: randomUUID(),
      customProblem: { title: "Private graph problem", link: "https://example.com/problems/private-graph" },
    };
    const customCreated = await a.post("/api/journal", { data: customPayload });
    expect(customCreated.ok(), await customCreated.text()).toBe(true);
    const customResult = await customCreated.json();
    expect(customResult.problem).toMatchObject({ id: customPayload.problemId, question_title: "Private graph problem", problemLink: customPayload.customProblem.link, custom: true });
    expect((await a.post("/api/journal", { data: customPayload })).ok()).toBe(true);
    const customJournal = await (await a.get("/api/journal")).json();
    expect(customJournal.problems).toEqual([customResult.problem]);
    expect(customJournal.attempts).toHaveLength(1);
    expect((await b.post("/api/journal", { data: { ...customPayload, id: randomUUID(), customProblem: undefined } })).status()).toBe(400);
    expect((await b.post("/api/journal", { data: { ...customPayload, id: randomUUID() } })).status()).toBe(409);
    expect((await a.delete(`/api/journal/${customResult.attempt.id}`, { data: { version: 1 } })).ok()).toBe(true);
    expect((await (await a.get("/api/progress")).json()).solvedIds).toEqual(["dttyps", "srinpttpt"]);

    expect((await a.post("/api/auth/sign-out", { headers: { origin: "https://evil.example" }, data: {} })).status()).toBe(403);
    const bSession = await (await b.get("/api/auth/get-session")).json();
    await pool.query('UPDATE session SET "expiresAt" = now() - interval \'1 day\' WHERE "userId" = $1', [bSession.user.id]);
    expect((await b.get("/api/progress")).status()).toBe(401);
    expect((await b.get("/api/journal")).status()).toBe(401);

    const savedSession = await a.storageState();
    expect((await a.post("/api/auth/sign-out", { data: {} })).ok()).toBe(true);
    const replay = await playwright.request.newContext({ baseURL: origin, storageState: savedSession });
    expect((await replay.get("/api/progress")).status()).toBe(401);
    expect((await replay.get("/api/journal")).status()).toBe(401);
    await replay.dispose();
  } finally {
    await a.dispose();
    await b.dispose();
  }
});

test("authentication throttles repeated sign-in attempts", async ({ request }) => {
  let throttled = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await request.post("/api/auth/sign-in/email", {
      headers: { origin }, data: { email: "nonexistent-rate-limit-test@example.com", password },
    });
    if (response.status() === 429) { throttled = true; break; }
    expect(response.status()).toBe(401);
  }
  expect(throttled).toBe(true);
});

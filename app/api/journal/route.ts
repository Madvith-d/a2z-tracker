import { HttpError, readBody, withUser } from "@/lib/api";
import { assertProblemAccess, createAttempt, createAttemptWithCustomProblem, getAttempts, getCustomProblems } from "@/lib/journal";
import { createAttemptRequestSchema } from "@/lib/journal-schema";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return withUser(request, async (userId) => {
    const [attempts, problems] = await Promise.all([getAttempts(userId), getCustomProblems(userId)]);
    return { attempts, problems };
  });
}
export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const parsed = createAttemptRequestSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Check the attempt fields.");
    const { id, customProblem, ...data } = parsed.data;
    if (customProblem) return createAttemptWithCustomProblem(userId, id, data, customProblem);
    await assertProblemAccess(userId, data.problemId);
    return { attempt: await createAttempt(userId, id, data) };
  });
}

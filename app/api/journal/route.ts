import { HttpError, readBody, withUser } from "@/lib/api";
import { createAttempt, getAttempts } from "@/lib/journal";
import { createAttemptSchema } from "@/lib/journal-schema";
import { problemIds } from "@/lib/roadmap";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return withUser(request, async (userId) => ({ attempts: await getAttempts(userId) }));
}
export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const parsed = createAttemptSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Check the attempt fields.");
    const { id, ...data } = parsed.data;
    if (!problemIds.has(data.problemId)) throw new HttpError(400, "Choose a question from the roadmap.");
    return { attempt: await createAttempt(userId, id, data) };
  });
}

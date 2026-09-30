import { z } from "zod";
import { HttpError, readBody, withUser } from "@/lib/api";
import { getSolvedIds, setSolved } from "@/lib/progress";
import { problemIds } from "@/lib/roadmap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withUser(request, async (userId) => ({ solvedIds: await getSolvedIds(userId) }));
}

export async function PUT(request: Request) {
  return withUser(request, async (userId) => {
    const parsed = z.object({ problemId: z.string().max(200), solved: z.boolean() }).strict()
      .safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, "Provide a problemId and a boolean solved value.");
    if (!problemIds.has(parsed.data.problemId)) throw new HttpError(400, "Unknown problem.");
    await setSolved(userId, parsed.data.problemId, parsed.data.solved);
    return parsed.data;
  });
}

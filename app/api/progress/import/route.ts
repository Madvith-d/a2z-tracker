import { z } from "zod";
import { HttpError, readBody, withUser } from "@/lib/api";
import { getSolvedIds, importSolved } from "@/lib/progress";
import { problemIds } from "@/lib/roadmap";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const parsed = z.object({ problemIds: z.array(z.string().max(200)).max(problemIds.size) }).strict()
      .safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, "Invalid progress import.");
    const ids = [...new Set(parsed.data.problemIds)];
    if (ids.some((id) => !problemIds.has(id))) throw new HttpError(400, "Import contains an unknown problem.");
    await importSolved(userId, ids);
    return { solvedIds: await getSolvedIds(userId) };
  });
}

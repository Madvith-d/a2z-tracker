import { z } from "zod";
import { HttpError, readBody, withUser } from "@/lib/api";
import { assertProblemAccess, clearRevision, deleteAttempt, updateAttempt } from "@/lib/journal";
import { updateAttemptSchema, versionSchema } from "@/lib/journal-schema";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function attemptId(context: Context) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) throw new HttpError(400, "Invalid attempt ID.");
  return id;
}
export async function PUT(request: Request, context: Context) {
  return withUser(request, async (userId) => {
    const id = await attemptId(context);
    const parsed = updateAttemptSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "Check the attempt fields.");
    const { version, ...data } = parsed.data;
    await assertProblemAccess(userId, data.problemId);
    return { attempt: await updateAttempt(userId, id, version, data) };
  });
}
export async function PATCH(request: Request, context: Context) {
  return withUser(request, async (userId) => {
    const id = await attemptId(context);
    const parsed = versionSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, "Send the attempt version.");
    return { attempt: await clearRevision(userId, id, parsed.data.version) };
  });
}
export async function DELETE(request: Request, context: Context) {
  return withUser(request, async (userId) => {
    const id = await attemptId(context);
    const parsed = versionSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new HttpError(400, "Send the attempt version.");
    return deleteAttempt(userId, id, parsed.data.version);
  });
}

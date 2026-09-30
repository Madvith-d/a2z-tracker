import { NextResponse } from "next/server";
import { auth } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new HttpError(415, "Send a JSON request body.");
  }
  if (Number(request.headers.get("content-length")) > 20000) throw new HttpError(413, "Request too large.");
  const text = await request.text();
  if (text.length > 20000) throw new HttpError(413, "Request too large.");
  try { return JSON.parse(text) as unknown; }
  catch { throw new HttpError(400, "Invalid JSON."); }
}

export async function withUser(
  request: Request,
  action: (userId: string) => Promise<unknown>,
) {
  try {
    if (request.method !== "GET") {
      const configuredURL = process.env.BETTER_AUTH_URL;
      if (!configuredURL) throw new Error("BETTER_AUTH_URL is required.");
      // Reject cross-site writes, including requests without an Origin header.
      if (request.headers.get("origin") !== new URL(configuredURL).origin) {
        throw new HttpError(403, "Invalid request origin.");
      }
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new HttpError(401, "Please sign in to access your saved work.");
    return NextResponse.json(await action(session.user.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("Authenticated request failed:", error);
    return NextResponse.json(
      { error: error instanceof HttpError ? error.message : "Unable to access your saved work. Please try again." },
      { status: error instanceof HttpError ? error.status : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

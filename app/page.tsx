import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSolvedIds } from "@/lib/progress";
import { roadmap } from "@/lib/roadmap";
import { Roadmap } from "@/components/roadmap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const solvedIds = session ? await getSolvedIds(session.user.id) : [];
  return <Roadmap
    key={session?.user.id ?? "guest"}
    steps={roadmap}
    initialSolvedIds={solvedIds}
    user={session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null}
  />;
}

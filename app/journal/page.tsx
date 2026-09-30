import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAttempts } from "@/lib/journal";
import { topics, problemIds } from "@/lib/roadmap";
import { Journal } from "@/components/journal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Practice journal · A2Z" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const params = await searchParams;
  const problem = typeof params.problem === "string" && problemIds.has(params.problem) ? params.problem : "";
  return <Journal key={`${session?.user.id ?? "guest"}:${problem}`} initialAttempts={session ? await getAttempts(session.user.id) : []}
    initialProblem={problem} topics={topics.map(({ id, question_title, difficulty }) => ({ id, question_title, difficulty }))}
    user={session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null} />;
}

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAttempts, getCustomProblems } from "@/lib/journal";
import { topics, problemIds } from "@/lib/roadmap";
import { Journal } from "@/components/journal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Practice journal · A2Z" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const params = await searchParams;
  const customProblems = session ? await getCustomProblems(session.user.id) : [];
  const problem = typeof params.problem === "string" && (problemIds.has(params.problem) || customProblems.some((item) => item.id === params.problem)) ? params.problem : "";
  return <Journal key={`${session?.user.id ?? "guest"}:${problem}`} initialAttempts={session ? await getAttempts(session.user.id) : []}
    initialProblem={problem} topics={[...topics.map(({ id, question_title, difficulty }) => ({ id, question_title, difficulty, problemLink: null, custom: false as const })), ...customProblems]}
    user={session ? { id: session.user.id, name: session.user.name, email: session.user.email } : null} />;
}

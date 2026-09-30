"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { latestAttempts, localToday, outcomeLabels, type Attempt } from "@/lib/journal-schema";
import { AttemptEditor, type Draft, type JournalTopic } from "./attempt-editor";
import { WorkspaceNav, type WorkspaceUser } from "./workspace-nav";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}
export function Journal({ initialAttempts, initialProblem, topics, user }: {
  initialAttempts: Attempt[]; initialProblem: string; topics: JournalTopic[]; user: WorkspaceUser | null;
}) {
  const [attempts, setAttempts] = useState(initialAttempts);
  const [tab, setTab] = useState<"history" | "revision">("history");
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [today, setToday] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState("");
  const pendingRef = useRef(false);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const revision = useRef(0);
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const scopedTopic = topicMap.get(initialProblem);

  useEffect(() => {
    const tick = () => setToday(localToday());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user) return;
    async function refresh() {
      if (document.visibilityState !== "visible" || draft || pendingRef.current) return;
      const current = revision.current;
      try {
        const response = await fetch("/api/journal", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to refresh journal.");
        if (current === revision.current) setAttempts(data.attempts);
      } catch (error) {
        if (current === revision.current) setError(error instanceof Error ? error.message : "Unable to refresh journal.");
      }
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [user, draft]);

  function startAttempt(problemId = initialProblem) {
    revision.current++;
    setDraft({ id: crypto.randomUUID(), problemId });
    setMessage("");
  }
  function saved(attempt: Attempt) {
    revision.current++;
    setAttempts((current) => [attempt, ...current.filter((item) => item.id !== attempt.id)]);
    setError("");
    setMessage("Attempt saved.");
  }
  async function mutate(attempt: Attempt, method: "PATCH" | "DELETE") {
    if (pendingRef.current) return;
    pendingRef.current = true;
    revision.current++;
    setPending(attempt.id);
    setError(""); setMessage("");
    try {
      const response = await fetch(`/api/journal/${attempt.id}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: attempt.version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update this attempt.");
      if (method === "DELETE") setAttempts((current) => current.filter((item) => item.id !== attempt.id));
      else setAttempts((current) => current.map((item) => item.id === attempt.id ? data.attempt : item));
      setMessage(method === "DELETE" ? "Attempt deleted. Solved progress is unchanged." : "Revision cleared. Your attempt is still in the journal.");
      setDeleting("");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to reach the server. Please try again."); }
    finally { revision.current++; pendingRef.current = false; setPending(""); }
  }
  const scoped = attempts.filter((attempt) => !initialProblem || attempt.problemId === initialProblem);
  const queue = latestAttempts(scoped).filter((attempt) => attempt.nextReviewOn).sort((a, b) => a.nextReviewOn!.localeCompare(b.nextReviewOn!));
  const due = queue.filter((attempt) => today && attempt.nextReviewOn! <= today);
  const minutes = scoped.reduce((sum, attempt) => sum + (attempt.durationMinutes ?? 0), 0);
  const history = [...scoped].sort((a, b) => b.practicedOn.localeCompare(a.practicedOn) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const visible = (tab === "history" ? history : dueOnly ? due : queue).filter((attempt) =>
    (outcome === "all" || attempt.outcome === outcome) &&
    [topicMap.get(attempt.problemId)?.question_title, attempt.approach, attempt.mistakes].some((text) => text?.toLowerCase().includes(search.trim().toLowerCase())));

  return <div className="workspace"><WorkspaceNav active="journal" user={user} disabled={Boolean(pending || draft)} />
    <main className="container workspace-main" id="main-content">
      <div className="page-context">Practice / Journal</div>
      <header className="page-heading"><div><h1>Practice journal</h1><p>Keep the reasoning. Revisit the hard parts.</p></div>
        {user && <button className="primary-button" onClick={() => startAttempt()} disabled={Boolean(pending)}>Log attempt</button>}
      </header>
      {!user ? <section className="empty-state"><h2>A record of how you learn.</h2><p>Log repeat attempts, keep approach notes, and set a date to revisit each question. Your journal is private to your account.</p><Link className="button primary-button" href="/sign-in">Sign in to start</Link><Link href="/">Browse the roadmap →</Link></section>
        : <>
          {scopedTopic && <div className="question-context"><div><small>Question history</small><strong>{scopedTopic.question_title}</strong></div><Link href="/journal">All questions</Link></div>}
          <dl className="stat-strip"><div><dt>Attempts logged</dt><dd>{scoped.length}</dd></div><div><dt>Questions practiced</dt><dd>{new Set(scoped.map((item) => item.problemId)).size}</dd></div><div><dt>Minutes recorded</dt><dd>{minutes}</dd></div><div><dt>Due for revision</dt><dd>{today ? due.length : "—"}</dd></div></dl>
          <div className="journal-tabs" aria-label="Journal view"><button aria-pressed={tab === "history"} onClick={() => { setTab("history"); setVisibleCount(30); }}>Attempt history <span>{scoped.length}</span></button><button aria-pressed={tab === "revision"} onClick={() => { setTab("revision"); setVisibleCount(30); }}>Revision queue <span>{queue.length}</span></button></div>
          <div className="toolbar journal-toolbar"><label className="search-label">Search journal<input type="search" placeholder="Question, approach, or takeaway…" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(30); }} /></label>
            <label>Outcome<select value={outcome} onChange={(event) => { setOutcome(event.target.value); setVisibleCount(30); }}><option value="all">All outcomes</option>{Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {tab === "revision" && <label className="check-label"><input type="checkbox" checked={dueOnly} onChange={(event) => { setDueOnly(event.target.checked); setVisibleCount(30); }} />Due now only</label>}
          </div>
          {tab === "revision" && <p className="view-help">One reminder per question, from its latest dated attempt. Log another attempt after revisiting it, or clear the reminder.</p>}
          <div className="save-status" role="status">{pending ? "Saving…" : message}</div>
          {error && <p className="error-message" role="alert">{error}</p>}
          {visible.length ? <div className="attempt-list">{visible.slice(0, visibleCount).map((attempt) => {
            const topic = topicMap.get(attempt.problemId);
            const isDue = Boolean(today && attempt.nextReviewOn && attempt.nextReviewOn <= today);
            return <article className="attempt-row" key={attempt.id}>
              <div className="attempt-date"><time dateTime={tab === "revision" ? attempt.nextReviewOn! : attempt.practicedOn}>{formatDate(tab === "revision" ? attempt.nextReviewOn! : attempt.practicedOn)}</time>{tab === "revision" && <small className={isDue ? "due-label" : ""}>{isDue ? "Due for revision" : "Upcoming"}</small>}</div>
              <div className="attempt-content"><Link className="question-link" href={`/journal?problem=${encodeURIComponent(attempt.problemId)}`}>{topic?.question_title ?? attempt.problemId}</Link>
                <div className="attempt-meta"><span className={`outcome outcome-${attempt.outcome}`}>{outcomeLabels[attempt.outcome]}</span><span>{attempt.durationMinutes === null ? "Time not recorded" : `${attempt.durationMinutes} min`}</span><span>Confidence {attempt.confidence}/5</span></div>
                {(attempt.approach || attempt.mistakes) ? <details className="attempt-notes"><summary>Read notes</summary>{attempt.approach && <div><h3>Approach & notes</h3><p>{attempt.approach}</p></div>}{attempt.mistakes && <div><h3>Mistakes & takeaways</h3><p>{attempt.mistakes}</p></div>}</details> : <small>No notes recorded.</small>}
                {tab === "history" && attempt.nextReviewOn && <small className="attempt-review">Revision set for {formatDate(attempt.nextReviewOn)}</small>}
                {deleting === attempt.id && <div className="delete-confirm"><p>Delete this attempt and its notes? This cannot be undone. Solved progress stays unchanged.</p><div className="inline-actions"><button className="danger-button" disabled={Boolean(pending)} onClick={() => mutate(attempt, "DELETE")}>Delete permanently</button><button disabled={Boolean(pending)} onClick={() => setDeleting("")}>Keep attempt</button></div></div>}
              </div>
              <div className="attempt-actions">{tab === "revision" ? <><button onClick={() => startAttempt(attempt.problemId)} disabled={Boolean(pending)}>Log retry</button><button className="text-button" onClick={() => mutate(attempt, "PATCH")} disabled={Boolean(pending)}>Clear reminder</button></> : <><button onClick={() => { revision.current++; setDraft({ id: attempt.id, attempt, problemId: attempt.problemId }); }} disabled={Boolean(pending)}>Edit</button><button className="text-button" onClick={() => setDeleting(attempt.id)} disabled={Boolean(pending)}>Delete</button></>}</div>
            </article>;
          })}</div> : <section className="empty-state"><h2>{search || outcome !== "all" ? "No matching attempts." : tab === "revision" ? dueOnly ? "Nothing due right now." : "No revisions scheduled." : "Your first attempt starts here."}</h2>
            <p>{search || outcome !== "all" ? "Try another question name or clear your filters." : tab === "revision" ? "Set a next revision date when logging an attempt. Your latest attempt keeps the reminder up to date." : "Pick a question and note what worked, what didn’t, and when to try again."}</p>
            <button onClick={() => { if (search || outcome !== "all") { setSearch(""); setOutcome("all"); } else startAttempt(); }}>{search || outcome !== "all" ? "Clear filters" : "Log attempt"}</button></section>}
          {visible.length > visibleCount && <button className="load-more" onClick={() => setVisibleCount((count) => count + 30)}>Show more attempts</button>}
        </>}
      <footer>Private notes. Persistent progress. One question at a time.</footer>
    </main>
    {draft && <AttemptEditor key={draft.id} draft={draft} topics={topics} onClose={() => { revision.current++; setDraft(null); }} onSaved={saved} />}
  </div>;
}

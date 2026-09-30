"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { authClient } from "@/lib/auth-client";
import type { Step, Topic } from "@/lib/roadmap";
import { WorkspaceNav } from "./workspace-nav";

type User = { id: string; name: string; email: string };
const resources = [
  ["post_link", "BLOG", "post"], ["yt_link", "YT", "yt"], ["lc_link", "LC", "lc"],
  ["gfg_link", "GFG", "gfg"], ["cs_link", "CN", "cn"], ["plus_link", "TUF", "tuf"],
] as const;

async function progressRequest(path: string, method = "GET", body?: unknown) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to save progress.");
  return data;
}

function SectionButton({ title, topics, solved, open, onClick, id, nested = false }: {
  title: string; topics: Topic[]; solved: Set<string>; open: boolean; onClick: () => void; id: string; nested?: boolean;
}) {
  const count = topics.filter((topic) => solved.has(topic.id)).length;
  return <button type="button" className={`${nested ? "sub-collapsible" : "collapsible"} ${open ? "active" : ""}`}
    aria-expanded={open} aria-controls={id} onClick={onClick}
    style={{ "--progress-width": `${topics.length ? count / topics.length * 100 : 0}%` } as CSSProperties}>
    <span className="collapsible-title">{title}</span>
    <span className="progress-counter">{count}/{topics.length}</span>
    <span className="disclosure-icon" aria-hidden="true">{open ? "−" : "+"}</span>
  </button>;
}

export function Roadmap({ steps, initialSolvedIds, user }: { steps: Step[]; initialSolvedIds: string[]; user: User | null }) {
  const [solved, setSolved] = useState(() => new Set(initialSolvedIds));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const pendingRef = useRef(new Set<string>());
  const revision = useRef(0);
  const busyRef = useRef(false);
  const allTopics = steps.flatMap((s) => s.sub_steps.flatMap((sub) => sub.topics));
  const percent = Math.round(solved.size / allTopics.length * 100);

  // Reload saved progress when returning from another tab/device session.
  // A revision guard prevents a slow read from overwriting newer local writes.
  useEffect(() => {
    if (!user) return;
    async function sync() {
      if (document.visibilityState !== "visible" || pendingRef.current.size || busyRef.current) return;
      const currentRevision = revision.current;
      try {
        const data = await progressRequest("/api/progress");
        if (currentRevision === revision.current) setSolved(new Set<string>(data.solvedIds));
      } catch (error) {
        if (currentRevision === revision.current) setError(error instanceof Error ? error.message : "Unable to refresh progress.");
      }
    }
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [user]);

  function toggleSection(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function toggleProblem(id: string, checked: boolean) {
    if (!user || pendingRef.current.has(id) || busyRef.current) return;
    revision.current++;
    pendingRef.current.add(id);
    setPending(new Set(pendingRef.current));
    setError("");
    setMessage("");
    setSolved((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    try {
      await progressRequest("/api/progress", "PUT", { problemId: id, solved: checked });
      setMessage("Progress saved.");
    } catch (error) {
      setSolved((current) => {
        const next = new Set(current);
        if (checked) next.delete(id); else next.add(id);
        return next;
      });
      setError(`${error instanceof Error ? error.message : "Save could not be confirmed."} Your change was reverted here; reload to check the saved state or try again.`);
    } finally {
      revision.current++;
      pendingRef.current.delete(id);
      setPending(new Set(pendingRef.current));
    }
  }

  async function importProgress(raw: string | null) {
    if (!user || busyRef.current || pendingRef.current.size) return;
    setError("");
    setMessage("");
    busyRef.current = true;
    setBusy(true);
    revision.current++;
    try {
      if (!raw) throw new Error("No old progress found in this browser. You can also import an exported JSON file.");
      if (raw.length > 100000) throw new Error("Import file is too large.");
      const old = JSON.parse(raw);
      if (!old || typeof old !== "object" || Array.isArray(old)) throw new Error("Expected the old progress object: { \"problem-id\": true }.");
      const validIds = new Set(allTopics.map((topic) => topic.id));
      const ids = Object.entries(old).filter(([id, value]) => value === true && validIds.has(id)).map(([id]) => id);
      if (!ids.length) throw new Error("No solved problems from this sheet were found in the import.");
      const data = await progressRequest("/api/progress/import", "POST", { problemIds: ids });
      setSolved(new Set<string>(data.solvedIds));
      setMessage(`Imported ${ids.length} solved problems. Existing progress was kept.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to import progress.");
    } finally {
      revision.current++;
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function signOut() {
    if (pendingRef.current.size || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    revision.current++;
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Unable to sign out. Please try again.");
      // Discard all cached state belonging to the signed-out account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign out.");
      busyRef.current = false;
      setBusy(false);
    }
  }

  const hasFilter = Boolean(search.trim()) || filter !== "all";
  const filteredSteps = steps.map((step) => ({
    ...step,
    filteredSubs: step.sub_steps.map((sub) => ({
      ...sub,
      visibleTopics: sub.topics.filter((topic) =>
        topic.question_title.toLowerCase().includes(search.trim().toLowerCase()) &&
        (filter === "all" || (filter === "solved" ? solved.has(topic.id) : !solved.has(topic.id)))),
    })).filter((sub) => sub.visibleTopics.length),
  })).filter((step) => step.filteredSubs.length);

  return <div className="workspace"><WorkspaceNav active="roadmap" user={user} disabled={busy || pending.size > 0} onSignOut={signOut} />
    <main className="container workspace-main" id="main-content">
    <div className="page-context">Practice / Roadmap</div>
    <header className="page-heading">
      <div><h1>A2Z DSA Course Roadmap</h1>
      <p>{allTopics.length} questions. {steps.length} steps. A little practice, every day.</p></div>
      <Link className="button" href="/journal">Open journal</Link>
    </header>
    {user ? <section className="overall-progress" aria-label="Overall progress">
      <div><strong>{solved.size} / {allTopics.length} solved</strong><span>{percent}% complete</span></div>
      <progress max={allTopics.length} value={solved.size}>{percent}%</progress>
      <small>Saved to your account · {user.email}</small>
    </section> : <p className="notice"><Link href="/sign-in">Sign in</Link> or <Link href="/sign-up">create an account</Link> to mark problems solved and save your progress across devices. You can browse all resources without an account.</p>}
    <div className="toolbar">
      <label className="search-label">Search problems<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by problem name…" /></label>
      <label>Progress<select value={filter} onChange={(event) => setFilter(event.target.value)} disabled={!user}>
        <option value="all">All problems</option><option value="solved">Solved</option><option value="unsolved">Unsolved</option>
      </select></label>
      <button disabled={hasFilter} onClick={() => setExpanded(expanded.size ? new Set() : new Set(steps.flatMap((step) => [
        `step-${step.step_no}`, ...step.sub_steps.map((sub) => `sub-${step.step_no}-${sub.sub_step_no}`),
      ])))}>{expanded.size ? "Collapse all" : "Expand all"}</button>
    </div>
    {user && <details className="import-panel"><summary>Bring over progress from the old sheet</summary>
      <p>Import solved problems into <strong>{user.email}</strong>. This only adds progress; it never clears existing solves. Browser import works if you used the old sheet on this same address. Otherwise, import an exported <code>dsaRoadmapProgress</code> JSON file.</p>
      <div className="import-actions"><button disabled={busy || pending.size > 0} onClick={() => {
        try { void importProgress(localStorage.getItem("dsaRoadmapProgress")); }
        catch { setError("Browser storage is unavailable. Please import a JSON file instead."); }
      }}>Import browser progress</button>
      <label>Import JSON file<input type="file" accept=".json,application/json" disabled={busy || pending.size > 0} onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > 100000) { setError("Import file is too large."); return; }
        try { await importProgress(await file.text()); }
        catch { setError("Unable to read this file."); }
      }} /></label></div>
    </details>}
    <div className="save-status" role="status" aria-live="polite">{pending.size ? "Saving progress…" : busy ? "Please wait…" : message}</div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <div className="roadmap-sections">
      {filteredSteps.map((step) => {
        const stepId = `step-${step.step_no}`;
        const open = hasFilter || expanded.has(stepId);
        return <section key={stepId}>
          <SectionButton id={stepId} title={`Step ${step.step_no}: ${step.step_title}`} topics={step.sub_steps.flatMap((sub) => sub.topics)} solved={solved} open={open} onClick={() => { if (!hasFilter) toggleSection(stepId); }} />
          <div id={stepId} hidden={!open} className="content">
            {step.filteredSubs.map((sub) => {
              const subId = `sub-${step.step_no}-${sub.sub_step_no}`;
              const subOpen = hasFilter || expanded.has(subId);
              return <section key={subId}>
                <SectionButton nested id={subId} title={`${sub.sub_step_no}. ${sub.sub_step_title.replace(/\n/g, " ")}`} topics={sub.topics} solved={solved} open={subOpen} onClick={() => { if (!hasFilter) toggleSection(subId); }} />
                <div id={subId} hidden={!subOpen}>
                  {subOpen && <div className="table-container" tabIndex={0} role="region" aria-label={`${sub.sub_step_title} problems`}>
                    <table><thead><tr><th scope="col" className="topic-cell">Question</th><th scope="col" className="resources-heading">Resources</th><th scope="col">Practice</th><th scope="col">Done</th></tr></thead>
                      <tbody>{sub.visibleTopics.map((topic) => <tr key={topic.id} className={`difficulty-${topic.difficulty} ${solved.has(topic.id) ? "completed" : ""}`}>
                        <td className="topic-cell"><span>{topic.question_title}</span><small className="difficulty-label">{["Easy", "Medium", "Hard"][topic.difficulty ?? -1] ?? "Unrated"}</small></td>
                        <td className="resource-cell"><div className="resource-links">{resources.map(([field, label, logo]) => {
                          const url = topic[field];
                          return url && /^https?:\/\//i.test(url) ? <a key={field} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${topic.question_title} on ${label}`}>
                            <Image src={`/assets/logo/${logo}.svg`} width={18} height={18} alt="" /><span>{label}</span>
                          </a> : null;
                        })}</div></td>
                        <td className="journal-cell"><Link href={`/journal?problem=${encodeURIComponent(topic.id)}`} aria-label={`Journal for ${topic.question_title}`}>Journal ↗</Link></td>
                        <td className="done-cell"><label className="checkbox-target"><span className="mobile-done-label">Done</span><input type="checkbox" className="status-checkbox" aria-label={`Mark ${topic.question_title} solved`}
                          checked={solved.has(topic.id)} disabled={!user || busy || pending.has(topic.id)} onChange={(event) => toggleProblem(topic.id, event.target.checked)} /></label></td>
                      </tr>)}</tbody>
                    </table>
                  </div>}
                </div>
              </section>;
            })}
          </div>
        </section>;
      })}
      {filteredSteps.length === 0 && <p className="notice">No problems match your filters.</p>}
    </div>
    <footer>For educational purposes only. Learning resources belong to their respective creators.</footer>
  </main></div>;
}

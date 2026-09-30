"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createAttemptSchema, localToday, outcomeLabels, type Attempt, type AttemptFields } from "@/lib/journal-schema";

export type JournalTopic = { id: string; question_title: string; difficulty: number | null };
export type Draft = { id: string; attempt?: Attempt; problemId: string };

export function AttemptEditor({ draft, topics, onClose, onSaved }: {
  draft: Draft; topics: JournalTopic[]; onClose: () => void; onSaved: (attempt: Attempt) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [fields, setFields] = useState<AttemptFields>(() => draft.attempt ?? {
    problemId: draft.problemId, practicedOn: localToday(), outcome: "struggled", durationMinutes: null,
    confidence: 3, approach: "", mistakes: "", nextReviewOn: null,
  });
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() {
    if (busyRef.current) return;
    if (dirty && !window.confirm("Discard these unsaved notes?")) return;
    dialog.current?.close();
    onClose();
  }
  function change<K extends keyof AttemptFields>(key: K, value: AttemptFields[K]) {
    setDirty(true);
    setFields((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const payload: AttemptFields = {
      problemId: fields.problemId, practicedOn: fields.practicedOn, outcome: fields.outcome,
      durationMinutes: fields.durationMinutes, confidence: fields.confidence,
      approach: fields.approach, mistakes: fields.mistakes, nextReviewOn: fields.nextReviewOn,
    };
    const parsed = createAttemptSchema.safeParse({ ...payload, id: draft.id });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the attempt fields."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(draft.attempt ? `/api/journal/${draft.id}` : "/api/journal", {
        method: draft.attempt ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...(draft.attempt ? { version: draft.attempt.version } : { id: draft.id }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save this attempt.");
      setDirty(false);
      onSaved(data.attempt);
      dialog.current?.close();
      onClose();
    } catch (error) { setError(`${error instanceof Error ? error.message : "Unable to reach the server."} Your notes are still here.`); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const choices = topics.filter((topic) => topic.id === fields.problemId || topic.question_title.toLowerCase().includes(questionSearch.toLowerCase()));
  return <dialog className="attempt-dialog" ref={dialog} aria-labelledby="attempt-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="dialog-heading"><h2 id="attempt-title">{draft.attempt ? "Edit attempt" : "Log an attempt"}</h2><button type="button" onClick={close} disabled={busy}>Close</button></div>
    <p className="muted">Capture what you tried, not just whether it passed.</p>
    <form onSubmit={submit} aria-busy={busy} aria-describedby="attempt-feedback">
      <fieldset disabled={busy}>
        <label>Find a question<input type="search" value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search the 455 questions…" /></label>
        <label>Question<select required value={fields.problemId} onChange={(event) => change("problemId", event.target.value)}>
          <option value="" disabled>Select a question</option>{choices.map((topic) => <option key={topic.id} value={topic.id}>{topic.question_title}</option>)}
        </select></label>
        <div className="form-grid">
          <label>Practice date<input type="date" required min="1900-01-01" max="2100-12-31" value={fields.practicedOn} onChange={(event) => change("practicedOn", event.target.value)} /></label>
          <label>Time spent (minutes)<input type="number" min={1} max={1440} step={1} placeholder="Optional" value={fields.durationMinutes ?? ""} onChange={(event) => change("durationMinutes", event.target.value ? Number(event.target.value) : null)} /></label>
          <label>Outcome<select value={fields.outcome} onChange={(event) => change("outcome", event.target.value as AttemptFields["outcome"])}>
            {Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Confidence<select value={fields.confidence} onChange={(event) => change("confidence", Number(event.target.value))}>
            <option value={1}>1 · Need to relearn</option><option value={2}>2 · Need guidance</option><option value={3}>3 · Getting there</option><option value={4}>4 · Can solve again</option><option value={5}>5 · Can explain it</option>
          </select></label>
        </div>
        <label>Approach & notes<textarea rows={3} maxLength={4000} value={fields.approach} onChange={(event) => change("approach", event.target.value)} placeholder="The pattern, your reasoning, or time and space complexity…" /></label>
        <label>Mistakes & takeaways<textarea rows={3} maxLength={4000} value={fields.mistakes} onChange={(event) => change("mistakes", event.target.value)} placeholder="What blocked you? What would you do differently?" /></label>
        <label>Next revision (optional)<input type="date" min={fields.practicedOn || "1900-01-01"} max="2100-12-31" value={fields.nextReviewOn ?? ""} onChange={(event) => change("nextReviewOn", event.target.value || null)} /></label>
        <small>The latest dated attempt sets this question’s reminder. Solved progress stays unchanged.</small>
      </fieldset>
      <div id="attempt-feedback" className="form-feedback">{error && <p className="error-message" role="alert">{error}</p>}</div>
      <div className="dialog-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : draft.attempt ? "Save changes" : "Save attempt"}</button></div>
    </form>
  </dialog>;
}

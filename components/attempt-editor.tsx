"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createAttemptRequestSchema, localToday, outcomeLabels, type Attempt, type AttemptFields } from "@/lib/journal-schema";

export type JournalTopic = { id: string; question_title: string; difficulty: number | null; problemLink: string | null; custom: boolean };
export type Draft = { id: string; attempt?: Attempt; problemId: string };

export function AttemptEditor({ draft, topics, onClose, onSaved }: {
  draft: Draft; topics: JournalTopic[]; onClose: () => void; onSaved: (attempt: Attempt, problem?: JournalTopic) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customLink, setCustomLink] = useState("");
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
    const parsed = createAttemptRequestSchema.safeParse({
      ...payload, id: draft.id,
      customProblem: customMode ? { title: customTitle, link: customLink } : undefined,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check the attempt fields."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(draft.attempt ? `/api/journal/${draft.id}` : "/api/journal", {
        method: draft.attempt ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(draft.attempt ? { version: draft.attempt.version } : { id: draft.id, ...(customMode ? { customProblem: { title: customTitle.trim(), link: customLink } } : {}) }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save this attempt.");
      setDirty(false);
      onSaved(data.attempt, data.problem);
      dialog.current?.close();
      onClose();
    } catch (error) { setError(`${error instanceof Error ? error.message : "Unable to reach the server."} Your notes are still here.`); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const choices = topics.filter((topic) => topic.id === fields.problemId || topic.question_title.toLowerCase().includes(questionSearch.toLowerCase()));
  const selectedProblem = topics.find((topic) => topic.id === fields.problemId);
  function startCustomProblem() {
    setCustomMode(true);
    setDirty(true);
    setFields((current) => ({ ...current, problemId: crypto.randomUUID() }));
  }
  return <dialog className="attempt-dialog" ref={dialog} aria-labelledby="attempt-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="dialog-heading"><h2 id="attempt-title">{draft.attempt ? "Edit attempt" : "Log an attempt"}</h2><button type="button" onClick={close} disabled={busy}>Close</button></div>
    <p className="muted">Capture what you tried, not just whether it passed.</p>
    <form onSubmit={submit} aria-busy={busy} aria-describedby="attempt-feedback">
      <fieldset disabled={busy}>
        {!customMode ? <>
          <label>Find a question<input type="search" value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search roadmap and custom problems…" /></label>
          <label>Question<select required value={fields.problemId} onChange={(event) => change("problemId", event.target.value)}>
            <option value="" disabled>Select a question</option>{choices.map((topic) => <option key={topic.id} value={topic.id}>{topic.question_title}{topic.custom ? " · Custom" : ""}</option>)}
          </select></label>
          {selectedProblem?.problemLink && <a className="problem-preview-link" href={selectedProblem.problemLink} target="_blank" rel="noreferrer">Open problem ↗</a>}
          {!draft.attempt && <div className="custom-problem-prompt"><span>Not on the sheet?</span><button type="button" onClick={startCustomProblem}>Add custom problem</button></div>}
        </> : <div className="custom-problem-fields">
          <div className="custom-problem-heading"><strong>Custom problem</strong><button type="button" className="text-button" onClick={() => { setCustomMode(false); change("problemId", draft.problemId); }}>Choose from list</button></div>
          <label>Problem name<input required maxLength={200} value={customTitle} onChange={(event) => { setDirty(true); setCustomTitle(event.target.value); }} placeholder="e.g. Merge Intervals" /></label>
          <label>Problem link<input type="url" required maxLength={2048} value={customLink} onChange={(event) => { setDirty(true); setCustomLink(event.target.value); }} placeholder="https://leetcode.com/problems/…" /></label>
        </div>}
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

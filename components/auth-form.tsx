"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const registering = mode === "sign-up";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    const name = String(form.get("name") ?? "").trim();
    if (registering && !name) { setError("Please enter your name."); return; }
    setBusy(true);
    setError("");
    try {
      const result = registering
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : registering ? result.error.message || "Unable to create account." : "Unable to sign in. Check your email and password.");
        setBusy(false);
        return;
      }
      // A full navigation discards all cached state from a previous account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      setError("Unable to reach the server. Please try again.");
      setBusy(false);
    }
  }

  return <main className="container auth-card">
    <Link className="wordmark" href="/" aria-label="A2Z home">a2z<span className="wordmark-dot">.</span></Link>
    <Link className="auth-back" href="/">← Back to the roadmap</Link>
    <h1>{registering ? "Create your account" : "Welcome back"}</h1>
    <p>{registering ? "A place for your progress, practice notes, and next attempt." : "Sign in to continue your DSA roadmap."}</p>
    <form onSubmit={submit} aria-busy={busy} aria-describedby="auth-feedback">
      {registering && <label>Name<input name="name" autoComplete="name" maxLength={100} required disabled={busy} /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></label>
      <label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"}
        minLength={registering ? 12 : 1} maxLength={128} required disabled={busy} aria-describedby={registering ? "password-hint" : undefined} /></label>
      {registering && <small id="password-hint">Use 12–128 characters. A unique passphrase works well.</small>}
      <div id="auth-feedback" className="form-feedback">{error && <p className="error-message" role="alert">{error}</p>}</div>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
    </form>
    <p>{registering ? "Already have an account? " : "New here? "}<Link href={registering ? "/sign-in" : "/sign-up"}>{registering ? "Sign in" : "Create an account"}</Link></p>
  </main>;
}

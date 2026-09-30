"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export type WorkspaceUser = { id: string; name: string; email: string };
export function WorkspaceNav({ active, user, disabled = false, onSignOut }: {
  active: "roadmap" | "journal"; user: WorkspaceUser | null; disabled?: boolean; onSignOut?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    if (onSignOut) return onSignOut();
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed. Try again.");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch { setError("Sign out failed. Try again."); setBusy(false); }
  }
  return <aside className="workspace-nav">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Link href="/" className="wordmark" aria-label="A2Z home">a2z<span className="wordmark-dot">.</span></Link>
    <p className="workspace-caption">Your DSA workspace</p>
    <nav aria-label="Workspace" className="workspace-links">
      <Link href="/" aria-current={active === "roadmap" ? "page" : undefined}>Roadmap <span>455</span></Link>
      <Link href="/journal" aria-current={active === "journal" ? "page" : undefined}>Practice journal</Link>
    </nav>
    <div className="workspace-account">
      {user ? <><span className="user-name">{user.name}</span><small className="user-email">{user.email}</small>
        <button className="text-button" onClick={signOut} disabled={disabled || busy}>Sign out</button></>
        : <><small>Keep your progress and notes.</small><Link className="button primary-button" href="/sign-up">Create account</Link><Link href="/sign-in">Sign in</Link></>}
      {error && <p role="alert" className="error-message">{error}</p>}
    </div>
  </aside>;
}

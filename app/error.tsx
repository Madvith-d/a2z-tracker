"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="container auth-card">
    <h1>Unable to load the roadmap</h1>
    <p>Please try again. If you run this app locally, make sure PostgreSQL is running and migrations have been applied.</p>
    <button onClick={reset}>Try again</button>
  </main>;
}

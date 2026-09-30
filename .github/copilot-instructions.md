# A2Z DSA Roadmap — contributor instructions

## Architecture

- Next.js App Router, TypeScript, and React. `app/page.tsx` reads the session and initial progress on the server; `components/roadmap.tsx` handles client interactions.
- Better Auth (`lib/auth.ts`) owns email/password authentication and PostgreSQL-backed sessions. `app/api/auth/[...all]/route.ts` exposes its handlers.
- PostgreSQL runs locally via `compose.yaml`. The optional `app` profile runs migrations and the production Next.js container too.
- `a2z.json` remains the canonical curriculum: steps → sub-steps → topics. Topic IDs are stable database keys. `lib/roadmap.ts` projects the fields the UI needs.
- `/journal` reads the session and private attempts on the server; `components/journal.tsx` owns history/revision views and `components/attempt-editor.tsx` owns drafts. Shared navigation lives in `components/workspace-nav.tsx`.
- Journal writes use strict `lib/journal-schema.ts` validation, same-origin authenticated APIs, and owner-scoped/version-checked queries in `lib/journal.ts`. Attempt outcomes must never update solved progress. Identical client-UUID POST retries are idempotent.
- Revision reminders come from each question’s latest practice date, then creation timestamp and ID—not update time. Deleting that attempt may restore an older reminder. Calendar dates are ISO strings; due dates use the browser’s local today.
- `problem_progress` has a composite `(user_id, problem_id)` primary key. A row means solved. Never accept a user ID from the client when reading/writing progress.

## Development

See `README.md` and `.env.example` for setup. Use Node 24 LTS.

```bash
npm ci
npm run db:up
npm run db:migrate
npm run dev
```

The default local database port is 5434; the Next.js app uses port 3000.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

Playwright needs Chromium installed and a migrated database. Auth rate limiting remains enabled; wait a minute between repeated test runs if throttled. Test cleanup must delete only its own generated accounts, not developer data.

## Conventions

- Use parameterized SQL, session-derived user IDs, and validated inputs. Keep cross-origin protections enabled.
- Migrations live in `migrations/` and run through `scripts/migrate.ts`. Never change an already-applied SQL migration; add a new numbered file.
- After curriculum edits, rerun migrations and rebuild. Do not reassign existing topic IDs or silently delete saved progress.
- Optimistic UI changes must have pending states and error rollback. Importing legacy progress is opt-in and additive.
- Preserve `app/globals.css`; the light workspace layer is `app/workspace.css`, loaded after root `tokens.css`. Follow the locked system in `design.md`; use named tokens, visible focus rings, and reduced-motion support.
- Resource logos live under `public/assets/logo/`. `legacy/index.html` is an archive, not the active frontend.
- Secrets belong in ignored `.env` files, never in source or client bundles.
- The original Python maintenance scripts still operate on `a2z.json`; maintain their compatibility.
- Do not run `docker compose down -v` or clear database tables without explicit permission.

# A2Z DSA Roadmap

A Next.js (App Router + TypeScript) version of the A2Z sheet, with email/password accounts, PostgreSQL-backed progress, and a private practice journal. All **455 problems across 18 steps** and their resource links are preserved.

## Features

- Register, sign in, and sign out using Better Auth.
- Mark problems solved/unsolved; progress belongs to the signed-in user and survives reloads, sign-outs, and container restarts.
- Overall, step, and sub-step progress counters; expandable sections; search and solved/unsolved filters.
- A private **Practice journal** at `/journal`: log repeat attempts, outcomes, time spent, confidence, approach notes, mistakes, and optional revision dates.
- Per-question history from each roadmap row, custom problems with their own links, searchable attempt history, and a due/upcoming revision queue.
- A warm, light workspace with self-hosted Geist, desktop side navigation, and stacked question rows on mobile.
- Guests can browse resources but cannot modify progress or read private journals.
- Optimistic updates with pending indicators and rollback/error messages when saves fail.
- Optional additive import of the old sheet's `dsaRoadmapProgress` localStorage data or a JSON export.

## Quick start: everything in Docker

Requires Docker Engine/Desktop with Docker Compose v2 or newer.

```bash
cp .env.example .env
openssl rand -hex 32
# Set BETTER_AUTH_SECRET in .env to the generated value.

docker compose --profile app up --build -d
```

Open **http://localhost:3000** and create an account. No demo credentials or external authentication service are needed. Compose waits for PostgreSQL, runs migrations, then starts the production Next.js app.

If `.env` already exists, keep it rather than overwriting its secret or database configuration.

```bash
docker compose --profile app logs -f app      # Application logs
docker compose --profile app logs migrate    # Migration output
docker compose --profile app down            # Stop; data is retained
```

Data lives in the named `a2z-roadmap_postgres_data` volume. **Do not use `down -v` unless you intend to permanently delete all accounts, progress, and journal notes.**

## Development: Next.js locally, PostgreSQL in Docker

Requires Node.js **24 LTS** and npm, plus Docker.

```bash
cp .env.example .env
# Generate BETTER_AUTH_SECRET with openssl rand -hex 32 and put it in .env.
npm ci
npm run db:up
npm run db:migrate
npm run dev
```

Open **http://localhost:3000**. Stop the Docker app first if you previously started the full stack, so it does not occupy port 3000:

```bash
docker compose --profile app stop app
```

The database is exposed only on **127.0.0.1:5434** (container port 5432). This avoids common conflicts with other local PostgreSQL instances. If 5434 is occupied, change both `POSTGRES_PORT` and the port in `DATABASE_URL` in `.env`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker PostgreSQL initialization credentials. |
| `POSTGRES_PORT` | Host database port; defaults to `5434`. |
| `DATABASE_URL` | Connection string for host-side Next.js, migrations, and tests. |
| `BETTER_AUTH_SECRET` | Random secret, at least 32 characters. Never commit it. |
| `BETTER_AUTH_URL` | Exact browser-facing origin, normally `http://localhost:3000`. |

Compose overrides `DATABASE_URL` inside its app/migration containers to use `db:5432`. Use URL-safe database credentials (for example, a hex password). Changing `POSTGRES_PASSWORD` after a volume is initialized does **not** change the existing database password; change it in PostgreSQL as well.

Use the configured hostname consistently: `localhost` and `127.0.0.1` are different origins. If changing the app port, update `BETTER_AUTH_URL` and the app's published/dev port too.

## Practice journal

Open **Practice journal → Log attempt**, or use **Journal ↗** beside a roadmap question to open that question’s history. Select a roadmap or previously added custom problem, or choose **Add custom problem** and provide its name and problem link. Then record:

- Practice date; outcome (still working on it / solved with help / solved independently).
- Optional time spent (1–1440 minutes) and confidence (1–5).
- Approach notes and mistakes/takeaways (up to 4000 characters each).
- Optional next revision date, on or after the practice date.

Logging an attempt **never checks or unchecks the roadmap’s solved status**, even when its outcome is “Solved independently.” You control that checkbox separately.

**Revision queue:** the latest attempt by practice date owns each question’s current reminder (creation time, then ID, break ties). A backdated entry does not replace a later attempt. A newer attempt without a reminder removes the question from the queue; clearing a reminder preserves the attempt. Deleting the latest attempt can restore the preceding attempt’s reminder. “Due now” includes today and overdue reminders, using your browser’s local calendar date. There are no email/push notifications.

Edit or delete attempts from history. Deletion asks for confirmation. Unsaved drafts warn before closing, failed saves retain your notes, and version checks prevent another tab’s changes from being silently overwritten. Drafts are not saved offline: copy your notes before reloading after a conflict. Journal data refreshes on returning to a tab when no editor/save is active.

The Notion link supplied as inspiration was a JavaScript-only shell when inspected. This is the approved practice-journal workflow, not an exact copy of that template.

## Database and authentication

- Better Auth manages users, hashed passwords (scrypt), database sessions, and auth rate-limit records. Passwords are never stored as plaintext.
- Session cookies are HTTP-only and SameSite=Lax. Sessions expire after seven days, refresh periodically, and are revoked server-side on sign-out. Cookie caching is disabled, so APIs always validate sessions against PostgreSQL.
- `problems` stores the stable topic IDs from `a2z.json`. `problem_progress` stores `(user_id, problem_id, solved_at)` with a composite primary key and foreign keys. A row means solved; unsolving deletes that user's row only.
- `practice_attempts` stores user-owned repeated attempts, notes, dates, and optimistic-concurrency versions. Custom problems are private `problems` rows with an owner and an HTTP(S) link; they never appear in roadmap progress. Migrations `002_practice_journal.sql` and `003_custom_journal_problems.sql` are additive; existing accounts and solved progress are unchanged.
- Progress and journal APIs derive the user ID from the session, never from request input. Requests use parameterized queries and validate problem IDs and booleans. Writes require the configured same-origin `Origin` header.
- Auth attempts are rate-limited in PostgreSQL, including five sign-in/sign-up requests per minute per client IP. Application restarts do not reset the limiter.

`npm run db:migrate` uses Better Auth's schema migration API, applies unapplied numbered SQL files in `migrations/`, and upserts the curriculum. It is safe to run again and does not reset existing progress. An advisory lock serializes concurrent migration processes. The pinned Better Auth version may log an `int8` type warning for `rateLimit.lastRequest` when rechecking its own schema; this is non-fatal.

After changing `a2z.json`, run migrations again to synchronize problem IDs, then restart/rebuild the app. Keep IDs stable to preserve progress. Existing Python data-maintenance scripts still use the root `a2z.json` unchanged.

### Local use vs. public deployment

This configuration is intended for local use. HTTP cookies are deliberately permitted on the local Docker app; using an **HTTPS** `BETTER_AUTH_URL` enables Secure cookies.

Before publishing publicly:

- Use HTTPS, a new high-entropy auth secret, and strong database credentials; keep PostgreSQL private.
- Add email delivery, verified-email requirements, and a password-reset flow if needed. **Email verification and password recovery are not configured in this local version.**
- Configure trusted reverse-proxy/IP handling and edge-level throttling for your deployment; do not blindly trust arbitrary forwarded-IP headers.
- Back up the database and review dependency/security updates before upgrading Better Auth's schema.

## Import progress from the static sheet

After signing in, expand **Bring over progress from the old sheet**. Choose **Import browser progress** if the old sheet was served on the same browser origin. Imports are explicit and additive: old `false` values never unset existing saved progress.

If the old site used another origin, run the following in that site's browser console to download the old data:

```js
const blob = new Blob([localStorage.getItem('dsaRoadmapProgress') || '{}'], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'a2z-progress.json';
link.click();
URL.revokeObjectURL(url);
```

Upload the file using **Import JSON file** in the Next.js app. The old browser data is not erased, and unknown topic IDs are ignored by the importer. The original HTML is archived in `legacy/index.html` for reference; it is no longer the app entry point.

## Checks and tests

With `.env` configured and the development database running/migrated:

```bash
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm test
```

Playwright starts a development server automatically unless the configured URL is already running, in which case it tests that server (including the Docker production app). Tests cover guest access, registration, incorrect passwords, reload/sign-in persistence, imports, failed-save rollback, unsolving, user isolation, invalid requests, cross-origin rejection, expired/revoked sessions, and auth throttling. Journal coverage includes CRUD, duplicate POST retries, stale versions, retained notes after failures, dirty-form cancellation, revision ordering, leap dates, and independence from solved progress. Axe checks cover the roadmap, registration, populated journal, and editor. Responsive screenshots are written to `/tmp/a2z-*.png` at 320/375/414/768/1280px; screenshots still need human visual review.

Tests create random temporary accounts and delete only those accounts afterward. Use a development database. Auth rate limiting stays enabled during tests; wait **60 seconds** between repeated suite runs if you receive 429 responses. Some Linux environments need Playwright's browser system dependencies installed separately.

## Project structure

```text
app/                    Next.js pages, styles, and API routes
components/             Shared navigation, auth, roadmap, journal, attempt editor
lib/auth.ts             Better Auth configuration
lib/db.ts               Shared PostgreSQL connection pool
lib/progress.ts          Per-user progress queries
lib/journal.ts           Owner-scoped, version-checked journal queries
lib/journal-schema.ts    Shared validation and reminder ordering
lib/roadmap.ts           Typed curriculum projection
tokens.css              Shared light-theme design tokens
design.md               Locked visual system and portable token adapters
migrations/             Versioned application SQL
scripts/migrate.ts      Auth migrations, SQL migrations, curriculum sync
scripts/*.py            Original data maintenance tools
a2z.json                Canonical curriculum (unchanged)
public/assets/logo/     Original resource logos
legacy/index.html       Original static implementation (reference)
tests/                  Browser and API integration tests
compose.yaml            Local PostgreSQL and optional full app stack
```

### Backup

```bash
docker compose exec -T db pg_dump -U a2z -d a2z > a2z-backup.sql
```

Use your configured user/database if different. Keep backups private: they contain accounts, sessions, saved progress, and private journal notes.

Disclaimer: For educational purposes only. Linked resources belong to their respective creators.

import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { topics } from "../lib/roadmap";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Copy .env.example to .env first.");
  const client = await db.connect();
  try {
    // Prevent two application containers from racing schema initialization.
    await client.query("SELECT pg_advisory_lock(20260930)");
    const authMigrations = await getMigrations(auth.options);
    await authMigrations.runMigrations();
    await client.query("BEGIN");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const directory = new URL("../migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(name, directory), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      console.log(`Applied ${name}`);
    }
    // Keep existing IDs stable; never delete progress when the curriculum grows.
    for (const topic of topics) {
      await client.query(
        "INSERT INTO problems (id, title) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title",
        [topic.id, topic.question_title],
      );
    }
    await client.query("COMMIT");
    console.log(`Database ready. ${topics.length} problems synchronized.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.query("SELECT pg_advisory_unlock(20260930)");
    client.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

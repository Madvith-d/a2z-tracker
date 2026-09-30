import { Pool } from "pg";

// Reuse connections during Next.js development hot reloads. No connection is
// opened until a query is made, so the app can build without a running database.
const globalForDb = globalThis as unknown as { a2zPool?: Pool };
export const db = globalForDb.a2zPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
if (process.env.NODE_ENV !== "production") globalForDb.a2zPool = db;
db.on("error", (error) => console.error("Idle database connection failed:", error.message));

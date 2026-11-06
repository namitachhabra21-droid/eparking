import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
import pg from "pg";

const schema = `
CREATE TABLE IF NOT EXISTS organizations (id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES organizations(id), email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('admin','operator','viewer')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS auth_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_token text NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS parking_state (organization_id uuid PRIMARY KEY REFERENCES organizations(id), data jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS auth_limits (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, resets_at timestamptz NOT NULL);
`;

export function createDatabase(pool) {
  let ready;
  let queue = Promise.resolve();
  return {
    init() {
      return (ready ||= this.transaction(async (tx) => {
        if (!pool.transaction)
          await tx.query("SELECT pg_advisory_xact_lock(72062411)");
        for (const sql of schema
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean))
          await tx.query(sql);
      }).catch((error) => {
        ready = null;
        throw error;
      }));
    },
    query: (...args) => pool.query(...args),
    async transaction(fn) {
      // PGlite is used only in local development/tests. Production uses independent PG clients.
      if (pool.transaction) {
        const run = queue.then(() => pool.transaction(fn));
        queue = run.catch(() => {});
        return run;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => (pool.end ? pool.end() : pool.close()),
  };
}
let database;
export async function getDatabase() {
  if (!database) {
    if (process.env.DATABASE_URL) {
      database = createDatabase(
        new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 4,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 20000,
        }),
      );
    } else {
      if (process.env.VERCEL || process.env.NODE_ENV === "production")
        throw new Error("DATABASE_URL is required in production");
      const { PGlite } = await import("@electric-sql/pglite");
      database = createDatabase(
        new PGlite(process.env.LOCAL_DATABASE_PATH || "./.data/postgres"),
      );
    }
  }
  await database.init();
  return database;
}

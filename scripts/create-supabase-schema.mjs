/**
 * One-shot schema runner: connects to the Supabase Postgres database and
 * applies supabase/schema.sql (idempotent — safe to run repeatedly).
 *
 * Usage:
 *   1. Put SUPABASE_DB_URL=postgresql://... in .env.local
 *      Use the SESSION POOLER URI (Settings → Database → Connection string →
 *      Connection pooling / session mode) — NOT the direct `db.<ref>.supabase.co`
 *      host, which is IPv6-only and unreachable from IPv4-only networks.
 *      Format: postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
 *      (percent-encode special chars in the password, e.g. @ → %40)
 *   2. node scripts/create-supabase-schema.mjs
 *
 * The URL stays in .env.local (git-ignored) — remove the line afterwards if
 * you no longer want the credential on disk.
 */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^SUPABASE_DB_URL=(.+)$/m);
if (!match) {
  console.error("✗ SUPABASE_DB_URL not found in .env.local");
  process.exit(1);
}

const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const client = new pg.Client({
  connectionString: match[1].trim(),
  ssl: { rejectUnauthorized: false }, // Supabase terminates TLS with its own cert chain
});

await client.connect();
try {
  await client.query(sql); // simple query protocol — multiple statements allowed
  console.log("✓ Schema applied: table, RLS policies, updated_at trigger, realtime publication");
} finally {
  await client.end();
}

// Applies db/migrations/*.sql in order, once each. Usage: npm run db:migrate
import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = neon(url);

await sql.query(
  "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
);
const done = new Set(
  (await sql.query("SELECT name FROM schema_migrations")).map((r) => r.name as string),
);
const dir = join(process.cwd(), "db", "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) {
    console.log("skip   ", file);
    continue;
  }
  const text = readFileSync(join(dir, file), "utf8");
  // The HTTP driver runs one statement per query; our migrations end statements with ";" at line end.
  const statements = text
    .split(/;[ \t]*\r?\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  const queries = statements.map((s) => sql.query(s));
  queries.push(sql.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]));
  await sql.transaction(queries);
  console.log("applied ", file);
}

// One-time account provisioning. Safe to re-run: never overwrites an existing account or PIN.
// Reads SEED_LOGIN_ID and SEED_PIN from the environment (never committed).
import { neon } from "@neondatabase/serverless";
import argon2 from "argon2";

const url = process.env.DATABASE_URL;
const loginId = (process.env.SEED_LOGIN_ID ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const pin = process.env.SEED_PIN ?? "";
if (!url || !loginId || !pin) throw new Error("DATABASE_URL, SEED_LOGIN_ID and SEED_PIN must be set");
const sql = neon(url);

const hash = await argon2.hash(pin, { type: argon2.argon2id });
const rows = await sql.query(
  "INSERT INTO users (login_id, pin_hash) VALUES ($1, $2) ON CONFLICT (login_id) DO NOTHING RETURNING id",
  [loginId, hash],
);
if (rows.length) {
  await sql.query(
    `INSERT INTO user_preferences (user_id, genres, languages, platforms, content_types)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING`,
    [
      rows[0].id,
      ["Thriller", "Science Fiction", "Drama"],
      ["Hindi", "English", "Tamil"],
      ["Netflix", "Amazon Prime Video", "JioHotstar"],
      ["movie", "series", "season", "episode"],
    ],
  );
  console.log("Created account", loginId);
} else {
  console.log("Account already exists; left untouched.");
}

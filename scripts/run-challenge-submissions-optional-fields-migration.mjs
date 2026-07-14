#!/usr/bin/env node
/**
 * Drop NOT NULL on product_price / what_makes_useful / what_to_improve so
 * the 100 Product Challenge submission form can make them optional.
 * Usage: node scripts/run-challenge-submissions-optional-fields-migration.mjs
 * Requires: DATABASE_URL in .env.local or environment
 *
 * Safe to re-run: DROP NOT NULL is a no-op if already dropped.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = ["0118_challenge_submissions_optional_fields.sql"];

async function runSqlStatements(sql, content) {
  const statements = content
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    const s = stmt.replace(/^--[^\n]*\n?/gm, "").trim();
    if (s.length > 0) await sql.unsafe(s + ";");
  }
}

async function verifyNullable(sql, tableName, columns) {
  const rows = await sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = ANY(${columns})
    ORDER BY column_name
  `;
  let ok = true;
  for (const row of rows) {
    const nullable = row.is_nullable === "YES";
    console.log(`  ${nullable ? "✓" : "✗"} ${row.column_name}: ${nullable ? "nullable" : "still NOT NULL"}`);
    if (!nullable) ok = false;
  }
  return ok;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  try {
    for (const file of migrations) {
      const path = join(__dirname, "..", "db", "migrations", file);
      const content = readFileSync(path, "utf8");
      await runSqlStatements(sql, content);
      console.log(`${file} applied.`);
    }

    console.log("\nVerifying columns:");
    const ok = await verifyNullable(sql, "challenge_submissions", ["product_price", "what_makes_useful", "what_to_improve"]);

    if (!ok) {
      console.error("\nVerification FAILED — one or more columns are still NOT NULL.");
      process.exit(1);
    }

    console.log("\nMigration done — columns verified nullable.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

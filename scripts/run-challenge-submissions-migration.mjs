#!/usr/bin/env node
/**
 * Run the 100 Product Challenge submissions migration.
 * Usage: node scripts/run-challenge-submissions-migration.mjs
 * Requires: DATABASE_URL in .env.local or environment
 *
 * Safe to re-run: every statement in the migration uses IF NOT EXISTS.
 * After applying, verifies the table exists and prints its column list.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = ["0117_challenge_submissions.sql"];

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

async function verifyTable(sql, tableName) {
  const rows = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  if (rows.length === 0) {
    console.error(`  ✗ ${tableName}: NOT FOUND`);
    return false;
  }
  console.log(`  ✓ ${tableName} (${rows.length} columns): ${rows.map((r) => r.column_name).join(", ")}`);
  return true;
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

    console.log("\nVerifying tables:");
    const ok = await verifyTable(sql, "challenge_submissions");

    if (!ok) {
      console.error("\nVerification FAILED — challenge_submissions table is missing.");
      process.exit(1);
    }

    console.log("\n100 Product Challenge migration done — table verified.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

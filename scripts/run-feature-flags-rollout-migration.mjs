#!/usr/bin/env node
/**
 * Add feature_flags.rollout_percentage.
 * Usage: node scripts/run-feature-flags-rollout-migration.mjs
 * Requires: DATABASE_URL in .env.local or environment
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = ["0116_feature_flags_rollout_percentage.sql"];

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
    console.log("Feature flags rollout percentage migration done.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

#!/usr/bin/env node
/**
 * Run UGC Lab migration (0025_ugc_lab_all_tables.sql).
 * Usage: node scripts/run-ugc-lab-migration.mjs
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
const migrationPath = join(__dirname, "..", "db", "migrations", "0025_ugc_lab_all_tables.sql");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const content = readFileSync(migrationPath, "utf8");
    const statements = content
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      const s = stmt.replace(/^--[^\n]*\n?/gm, "").trim();
      if (s.length > 0) await sql.unsafe(s + ";");
    }
    console.log("UGC Lab migration applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

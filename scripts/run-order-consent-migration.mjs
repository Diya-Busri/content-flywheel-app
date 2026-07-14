#!/usr/bin/env node
/**
 * Add consent-capture, access/download-tracking, and refund/revocation
 * columns to product_orders (new refund policy — see lib/refund-policy.ts).
 * Usage: node scripts/run-order-consent-migration.mjs
 * Requires: DATABASE_URL in .env.local or environment
 *
 * Safe to re-run: every ALTER TABLE uses IF NOT EXISTS.
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrations = ["0119_order_consent_and_refund_tracking.sql"];

const NEW_COLUMNS = [
  "buyer_user_id",
  "stripe_payment_intent_id",
  "consent_given",
  "consent_text",
  "consent_policy_version",
  "consent_timestamp",
  "access_granted_at",
  "first_download_at",
  "refunded_at",
  "refunded_by",
  "refund_reason",
  "access_revoked_at",
];

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

async function verifyColumns(sql, tableName, columns) {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = ANY(${columns})
  `;
  const found = new Set(rows.map((r) => r.column_name));
  let ok = true;
  for (const col of columns) {
    const present = found.has(col);
    console.log(`  ${present ? "✓" : "✗"} ${col}`);
    if (!present) ok = false;
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

    console.log("\nVerifying columns on product_orders:");
    const ok = await verifyColumns(sql, "product_orders", NEW_COLUMNS);

    if (!ok) {
      console.error("\nVerification FAILED — one or more columns are missing.");
      process.exit(1);
    }

    console.log("\nMigration done — columns verified present.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

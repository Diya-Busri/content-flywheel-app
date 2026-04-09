/**
 * Backfill existing Stripe payments into product_orders table.
 *
 * Run with:
 *   node scripts/backfill-stripe-orders.mjs
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY and DATABASE_URL set in .env.local
 *   - The product_orders table exists in your DB
 */

import Stripe from "stripe";
import postgres from "postgres";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = resolve(__dirname, "../.env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) {
    process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  }
}

const stripeKey = process.env.STRIPE_SECRET_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
if (!dbUrl) throw new Error("DATABASE_URL not set");

const stripe = new Stripe(stripeKey);
const sql = postgres(dbUrl, { ssl: "require" });

async function run() {
  console.log("🔍 Fetching completed Stripe checkout sessions...");

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Paginate through all checkout sessions
  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const session of sessions.data) {
      // Only process completed product purchases
      if (session.payment_status !== "paid") continue;
      if (session.metadata?.type !== "product_purchase") continue;

      const productId = session.metadata?.productId;
      const creatorUserId = session.metadata?.creatorUserId;

      if (!productId || !creatorUserId) {
        console.warn(`  ⚠️  Session ${session.id} missing productId/creatorUserId metadata — skipping`);
        continue;
      }

      // Check if already in DB
      const existing = await sql`
        SELECT id FROM product_orders WHERE stripe_session_id = ${session.id} LIMIT 1
      `;

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Get buyer info from session
      const buyerEmail = session.customer_details?.email ?? session.customer_email ?? "";
      const buyerName = session.customer_details?.name ?? null;
      const amountCents = session.amount_total ?? 0;
      const currency = session.currency ?? "gbp";

      // Generate a download token
      const downloadToken = crypto.randomUUID();
      const downloadExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year

      try {
        await sql`
          INSERT INTO product_orders (
            product_id,
            creator_user_id,
            buyer_email,
            buyer_name,
            amount_cents,
            currency,
            stripe_session_id,
            status,
            download_token,
            download_expires_at,
            email_sent,
            created_at
          ) VALUES (
            ${productId}::uuid,
            ${creatorUserId},
            ${buyerEmail},
            ${buyerName},
            ${amountCents},
            ${currency},
            ${session.id},
            'completed',
            ${downloadToken},
            ${downloadExpiresAt.toISOString()},
            true,
            ${new Date(session.created * 1000).toISOString()}
          )
        `;
        inserted++;
        console.log(`  ✅ Inserted order for session ${session.id} (${buyerEmail}, £${(amountCents / 100).toFixed(2)})`);
      } catch (err) {
        errors++;
        console.error(`  ❌ Failed to insert session ${session.id}:`, err.message);
      }
    }

    hasMore = sessions.has_more;
    if (sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1].id;
    }
  }

  console.log(`\n✨ Done! ${inserted} inserted, ${skipped} already existed, ${errors} errors`);
  await sql.end();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

/**
 * lib/revenue-bridge.ts — Phase 6.0
 * ──────────────────────────────────────────────────────────────────────────────
 * Reads real revenue data from connected stores (Stripe, Lemon Squeezy, Gumroad).
 * Returns a RevenueSnapshot for the requested period.
 *
 * Callers (Business OS, Growth Engine) always get a snapshot even when stores
 * are not connected — zero values with isReal=false to distinguish from
 * intentional £0 revenue days.
 */

import type { RevenueSnapshot } from "@/db/schema/launch-schema";

/* ─── Period helpers ─────────────────────────────────────────────────────────── */

function dayBounds(daysAgo = 1): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(0, 0, 0, 0); // midnight today (exclusive)
  const from = new Date(to);
  from.setDate(from.getDate() - daysAgo);
  return { from, to };
}

/* ─── Stripe ─────────────────────────────────────────────────────────────────── */

export async function fetchStripeRevenue(
  period: "yesterday" | "last7d" | "last30d" = "yesterday",
): Promise<{ totalRevenue: number; totalSales: number; refunds: number; refundRevenue: number; currency: string } | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;

  const daysAgo = period === "yesterday" ? 1 : period === "last7d" ? 7 : 30;
  const { from, to } = dayBounds(daysAgo);

  try {
    // Fetch succeeded charges
    const chargesUrl = new URL("https://api.stripe.com/v1/charges");
    chargesUrl.searchParams.set("created[gte]", String(Math.floor(from.getTime() / 1000)));
    chargesUrl.searchParams.set("created[lt]",  String(Math.floor(to.getTime()   / 1000)));
    chargesUrl.searchParams.set("status",        "succeeded");
    chargesUrl.searchParams.set("limit",         "100");

    const chargesRes = await fetch(chargesUrl.toString(), {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!chargesRes.ok) return null;

    const chargesData = await chargesRes.json() as {
      data?: Array<{ amount?: number; currency?: string; refunded?: boolean; amount_refunded?: number }>;
    };

    const charges = chargesData.data ?? [];
    let totalRevenue    = 0;
    let totalSales      = 0;
    let refunds         = 0;
    let refundRevenue   = 0;
    let currency        = "gbp";

    for (const c of charges) {
      const amount = (c.amount ?? 0) / 100; // pence → pounds
      totalRevenue += amount;
      totalSales   += 1;
      if (c.currency) currency = c.currency.toLowerCase();
      if (c.refunded) {
        refunds       += 1;
        refundRevenue += (c.amount_refunded ?? 0) / 100;
      }
    }

    return { totalRevenue, totalSales, refunds, refundRevenue, currency };
  } catch {
    return null;
  }
}

/* ─── Lemon Squeezy ──────────────────────────────────────────────────────────── */

export async function fetchLemonSqueezyRevenue(
  period: "yesterday" | "last7d" | "last30d" = "yesterday",
): Promise<{ totalRevenue: number; totalSales: number; refunds: number; refundRevenue: number; currency: string } | null> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim();
  if (!apiKey) return null;

  const daysAgo = period === "yesterday" ? 1 : period === "last7d" ? 7 : 30;
  const { from } = dayBounds(daysAgo);

  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/orders?filter[status]=paid&page[size]=100`,
      { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" } },
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      data?: Array<{
        attributes?: {
          total?: number;
          currency?: string;
          refunded?: boolean;
          refunded_amount?: number;
          created_at?: string;
        };
      }>;
    };

    let totalRevenue  = 0;
    let totalSales    = 0;
    let refunds       = 0;
    let refundRevenue = 0;
    let currency      = "usd";

    for (const order of data.data ?? []) {
      const attr = order.attributes;
      if (!attr?.created_at) continue;
      const created = new Date(attr.created_at);
      if (created < from) continue; // filter by period client-side

      const amount = (attr.total ?? 0) / 100;
      totalRevenue += amount;
      totalSales   += 1;
      if (attr.currency) currency = attr.currency.toLowerCase();
      if (attr.refunded) {
        refunds       += 1;
        refundRevenue += (attr.refunded_amount ?? 0) / 100;
      }
    }

    return { totalRevenue, totalSales, refunds, refundRevenue, currency };
  } catch {
    return null;
  }
}

/* ─── Gumroad ────────────────────────────────────────────────────────────────── */

export async function fetchGumroadRevenue(
  period: "yesterday" | "last7d" | "last30d" = "yesterday",
): Promise<{ totalRevenue: number; totalSales: number; refunds: number; refundRevenue: number; currency: string } | null> {
  const accessToken = process.env.GUMROAD_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;

  const daysAgo = period === "yesterday" ? 1 : period === "last7d" ? 7 : 30;
  const { from } = dayBounds(daysAgo);
  const after = from.toISOString().split("T")[0]; // "YYYY-MM-DD"

  try {
    const res = await fetch(
      `https://api.gumroad.com/v2/sales?after=${after}&page_key=`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;

    const data = await res.json() as {
      sales?: Array<{
        price?: number;
        currency?: string;
        refunded?: boolean;
        chargebacked?: boolean;
      }>;
    };

    let totalRevenue  = 0;
    let totalSales    = 0;
    let refunds       = 0;
    let refundRevenue = 0;

    for (const sale of data.sales ?? []) {
      const amount = (sale.price ?? 0) / 100;
      totalRevenue += amount;
      totalSales   += 1;
      if (sale.refunded || sale.chargebacked) {
        refunds       += 1;
        refundRevenue += amount;
      }
    }

    return { totalRevenue, totalSales, refunds, refundRevenue, currency: "usd" };
  } catch {
    return null;
  }
}

/* ─── Aggregator ─────────────────────────────────────────────────────────────── */

export async function fetchRevenueSnapshot(
  period: "yesterday" | "last7d" | "last30d" = "yesterday",
): Promise<RevenueSnapshot> {
  const daysAgo = period === "yesterday" ? 1 : period === "last7d" ? 7 : 30;
  const { from, to } = dayBounds(daysAgo);

  const [stripe, lemon, gumroad] = await Promise.all([
    fetchStripeRevenue(period),
    fetchLemonSqueezyRevenue(period),
    fetchGumroadRevenue(period),
  ]);

  const sources: RevenueSnapshot["sources"] = [];
  let totalRevenue  = 0;
  let totalSales    = 0;
  let refunds       = 0;
  let refundRevenue = 0;
  let currency      = "gbp";

  if (stripe) {
    totalRevenue  += stripe.totalRevenue;
    totalSales    += stripe.totalSales;
    refunds       += stripe.refunds;
    refundRevenue += stripe.refundRevenue;
    currency       = stripe.currency;
    sources.push({ name: "stripe", revenue: stripe.totalRevenue, sales: stripe.totalSales });
  }
  if (lemon) {
    totalRevenue  += lemon.totalRevenue;
    totalSales    += lemon.totalSales;
    refunds       += lemon.refunds;
    refundRevenue += lemon.refundRevenue;
    sources.push({ name: "lemonsqueezy", revenue: lemon.totalRevenue, sales: lemon.totalSales });
  }
  if (gumroad) {
    totalRevenue  += gumroad.totalRevenue;
    totalSales    += gumroad.totalSales;
    refunds       += gumroad.refunds;
    refundRevenue += gumroad.refundRevenue;
    sources.push({ name: "gumroad", revenue: gumroad.totalRevenue, sales: gumroad.totalSales });
  }

  return {
    totalSales,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    currency,
    refunds,
    refundRevenue: Math.round(refundRevenue * 100) / 100,
    conversionRate: 0, // placeholder — requires visitor data
    sources,
    period: {
      from: from.toISOString(),
      to:   to.toISOString(),
    },
  };
}

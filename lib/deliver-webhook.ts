import { db } from "@/db/db";
import { creatorWebhooksTable } from "@/db/schema/creator-webhooks-schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export type WebhookEvent = "product_sold" | "bundle_sold";

export async function deliverWebhooks(
  userId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const hooks = await db
    .select()
    .from(creatorWebhooksTable)
    .where(and(eq(creatorWebhooksTable.userId, userId), eq(creatorWebhooksTable.active, true)));

  const eligible = hooks.filter((h) => h.events.split(",").map((e) => e.trim()).includes(event));

  if (eligible.length === 0) return;

  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data: payload });

  await Promise.all(
    eligible.map(async (hook) => {
      const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
      let status = "ok";
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CF-Event": event,
            "X-CF-Signature": `sha256=${sig}`,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        status = res.ok ? "ok" : `error_${res.status}`;
      } catch (err) {
        status = "failed";
        console.error(`[webhook] Delivery failed to ${hook.url}:`, err);
      }

      // Update last delivery status (best-effort)
      await db
        .update(creatorWebhooksTable)
        .set({ lastStatus: status, lastDeliveredAt: new Date() })
        .where(eq(creatorWebhooksTable.id, hook.id))
        .catch(() => {});
    })
  );
}

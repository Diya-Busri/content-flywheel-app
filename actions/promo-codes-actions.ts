"use server";

import { auth } from "@clerk/nextjs/server";
import {
  createPromoCode,
  getAllPromoCodes,
  deletePromoCode,
  getPromoCodeByCode,
  incrementPromoCodeUses,
} from "@/db/queries/promo-codes-queries";
import { InsertPromoCode, SelectPromoCode } from "@/db/schema/promo-codes-schema";
import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";

function isAdmin(email: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  return !!adminEmail && email.trim().toLowerCase() === adminEmail;
}

async function assertAdmin() {
  const { userId } = auth();
  if (!userId) throw new Error("Unauthorized");
  const { currentUser } = await import("@clerk/nextjs/server");
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (!isAdmin(email)) throw new Error("Forbidden");
}

export async function createPromoCodeAction(
  data: InsertPromoCode
): Promise<ActionResult<SelectPromoCode>> {
  try {
    await assertAdmin();
    const normalized = { ...data, code: data.code.toUpperCase().trim() };
    const row = await createPromoCode(normalized);
    revalidatePath("/dashboard/admin/promo-codes");
    return { isSuccess: true, message: "Promo code created", data: row };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create promo code";
    return { isSuccess: false, message: msg };
  }
}

export async function getAllPromoCodesAction(): Promise<ActionResult<SelectPromoCode[]>> {
  try {
    await assertAdmin();
    const rows = await getAllPromoCodes();
    return { isSuccess: true, message: "OK", data: rows };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch promo codes";
    return { isSuccess: false, message: msg };
  }
}

export async function deletePromoCodeAction(id: string): Promise<ActionResult<void>> {
  try {
    await assertAdmin();
    await deletePromoCode(id);
    revalidatePath("/dashboard/admin/promo-codes");
    return { isSuccess: true, message: "Promo code deleted" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to delete promo code";
    return { isSuccess: false, message: msg };
  }
}

/**
 * Validate a promo code at checkout time.
 * Returns the code row if valid for the given plan, or an error message.
 * Also increments uses on success.
 */
export async function validateAndApplyPromoCodeAction(
  code: string,
  plan: "monthly" | "yearly"
): Promise<ActionResult<SelectPromoCode>> {
  try {
    const row = await getPromoCodeByCode(code);

    if (!row) return { isSuccess: false, message: "Invalid promo code" };
    if (!row.active) return { isSuccess: false, message: "Promo code is no longer active" };
    if (row.expiresAt && row.expiresAt < new Date()) return { isSuccess: false, message: "Promo code has expired" };
    if (row.maxUses !== null && row.usedCount >= row.maxUses) return { isSuccess: false, message: "Promo code has reached its usage limit" };
    if (row.plan !== "both" && row.plan !== plan) {
      return { isSuccess: false, message: `This code is only valid for the ${row.plan} plan` };
    }

    await incrementPromoCodeUses(row.id);
    return { isSuccess: true, message: "Promo code applied", data: row };
  } catch (error) {
    return { isSuccess: false, message: "Failed to validate promo code" };
  }
}

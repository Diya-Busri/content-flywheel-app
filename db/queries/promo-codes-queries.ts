import { db } from "@/db/db";
import { promoCodesTable, InsertPromoCode, SelectPromoCode } from "@/db/schema/promo-codes-schema";
import { eq, sql } from "drizzle-orm";

export async function createPromoCode(data: InsertPromoCode): Promise<SelectPromoCode> {
  const [row] = await db.insert(promoCodesTable).values(data).returning();
  return row;
}

export async function getAllPromoCodes(): Promise<SelectPromoCode[]> {
  return db.select().from(promoCodesTable).orderBy(promoCodesTable.createdAt);
}

export async function getPromoCodeByCode(code: string): Promise<SelectPromoCode | null> {
  const [row] = await db
    .select()
    .from(promoCodesTable)
    .where(eq(promoCodesTable.code, code.toUpperCase().trim()));
  return row ?? null;
}

export async function deletePromoCode(id: string): Promise<void> {
  await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
}

export async function incrementPromoCodeUses(id: string): Promise<void> {
  await db
    .update(promoCodesTable)
    .set({ usedCount: sql`${promoCodesTable.usedCount} + 1` })
    .where(eq(promoCodesTable.id, id));
}

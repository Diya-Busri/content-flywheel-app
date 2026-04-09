import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { adminExpensesTable, adminFinanceNotesTable } from "@/db/schema/admin-finances-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, sum, desc } from "drizzle-orm";
import FinancesClient from "./FinancesClient";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ?? "";

export const metadata = { title: "Finance Tracker | Admin" };

export default async function AdminFinancesPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const email = (sessionClaims?.email as string | undefined)?.trim().toLowerCase() ?? "";
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) redirect("/dashboard");

  const [expenses, notes, revenueResult] = await Promise.all([
    db.select().from(adminExpensesTable).orderBy(desc(adminExpensesTable.date)),
    db.select().from(adminFinanceNotesTable).orderBy(desc(adminFinanceNotesTable.createdAt)),
    db
      .select({ total: sum(productOrdersTable.amountCents) })
      .from(productOrdersTable)
      .where(eq(productOrdersTable.status, "completed")),
  ]);

  const revenueFromOrders = Number(revenueResult[0]?.total ?? 0);

  return (
    <FinancesClient
      initialExpenses={expenses}
      initialNotes={notes}
      revenueFromOrders={revenueFromOrders}
    />
  );
}

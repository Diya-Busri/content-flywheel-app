import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OrdersClient } from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <OrdersClient />;
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { StoreClient } from "./StoreClient";

export default async function StorePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <StoreClient userId={userId} />;
}

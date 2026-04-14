import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { userId } = auth();
  if (!userId) return redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

  if (!adminEmail || email.trim().toLowerCase() !== adminEmail) {
    return redirect("/dashboard");
  }

  return <>{children}</>;
}

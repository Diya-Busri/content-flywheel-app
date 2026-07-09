import { currentUser } from "@clerk/nextjs/server";

/** Returns true only if the currently authenticated user is the app admin. */
export async function isAdmin(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return false;
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
  return email === adminEmail;
}

export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { updateProfile } from "@/db/queries/profiles-queries";

export async function POST(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId: callerId } = await auth();
  if (!callerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!adminEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const caller = await currentUser();
  const callerEmail = caller?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  if (callerEmail !== adminEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = params;
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  await updateProfile(userId, {
    membership: "pro",
    status: "active",
  });

  return NextResponse.json({ ok: true });
}

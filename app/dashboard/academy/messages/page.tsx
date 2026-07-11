import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Messages tab removed — redirect to support directly
export default function AcademyMessagesPage() {
  redirect("/dashboard/academy/messages/support");
}

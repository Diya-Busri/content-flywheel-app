import { redirect } from "next/navigation";

// /dashboard/admin/store is not a real route — redirect to the store dashboard
export default function AdminStorePage() {
  redirect("/dashboard/store");
}

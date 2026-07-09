import { redirect } from "next/navigation";

// Launch workspaces now live in My Library → Launch Workspaces tab
export default function ProjectsRedirect() {
  redirect("/dashboard/library");
}

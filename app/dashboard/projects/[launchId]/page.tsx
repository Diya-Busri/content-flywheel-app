import { redirect } from "next/navigation";

// Project detail now served from the workspace page
export default function ProjectDetailRedirect({
  params,
}: {
  params: { launchId: string };
}) {
  redirect(`/dashboard/launch/${params.launchId}/workspace`);
}

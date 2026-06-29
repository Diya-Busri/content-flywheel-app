import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { isAdmin } from "@/lib/is-admin";
import { getReports } from "@/db/queries/messaging-queries";
import { getCommunityPostById, getComment } from "@/db/queries/academy-queries";
import { ReportsTable, ReportRow } from "./reports-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports | Admin" };

export default async function AdminReportsPage() {
  if (!(await isAdmin())) return redirect("/dashboard");

  const reports = await getReports();

  const rows: ReportRow[] = await Promise.all(
    reports.map(async (r) => {
      let preview = "";
      let postId: string | null = r.postId ?? null;
      if (r.postId) {
        const post = await getCommunityPostById(r.postId);
        preview = post ? `${post.title}: ${post.content}` : "(post deleted)";
      } else if (r.commentId) {
        const comment = await getComment(r.commentId);
        preview = comment ? comment.content : "(comment deleted)";
        postId = comment?.postId ?? null;
      }
      return {
        id: r.id,
        reason: r.reason,
        details: r.details,
        status: r.status,
        reportedByUserId: r.reportedByUserId,
        createdAt: new Date(r.createdAt).toISOString(),
        preview: preview.slice(0, 200),
        kind: r.postId ? "post" : "comment",
        postId,
      };
    })
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-foreground">
        <Flag className="h-6 w-6 text-primary" /> Reports
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">Reported community posts and comments.</p>
      <ReportsTable initialReports={rows} />
    </div>
  );
}

import Link from "next/link";
import { MessageCircle } from "lucide-react";

export function SupportCard() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">Need Help?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Message the Content Flywheel team if you have any questions or need assistance.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <Link
          href="/dashboard/academy/messages/support"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> Contact Support
        </Link>
      </div>
    </div>
  );
}

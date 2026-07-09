"use client";

import Link from "next/link";

export default function SignUpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F0F0F] px-4 text-white">
      <div className="max-w-md space-y-6 rounded-xl border border-border bg-card p-8">
        <h1 className="text-xl font-semibold">Sign-up didn’t load</h1>
        <p className="text-sm text-gray-400">
          This often means Clerk isn’t configured. Do the following:
        </p>
        <ol className="list-inside list-decimal space-y-2 text-sm text-gray-300">
          <li>
            Open <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.local</code> and add:
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
              {`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...`}
            </pre>
          </li>
          <li>Get keys from <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">dashboard.clerk.com</a></li>
          <li>Restart the dev server (<code className="rounded bg-muted px-1.5 py-0.5">npm run dev</code>)</li>
          <li>Hard refresh (Ctrl+Shift+R) or try an incognito window</li>
        </ol>
        <p className="text-xs text-gray-500">
          Console error: {error.message}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-border px-4 py-2 text-sm text-gray-300 hover:bg-muted"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

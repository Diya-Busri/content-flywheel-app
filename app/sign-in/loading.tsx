/** Shown during navigation to /sign-in - prevents blank screen. */
export default function SignInLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-background">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

import type { Metadata } from "next";
import { SignInWithRedirect } from "../sign-in-with-redirect";

export const metadata: Metadata = {
  title: "Sign In | Content Flywheel",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SignInWithRedirect />
    </div>
  );
}

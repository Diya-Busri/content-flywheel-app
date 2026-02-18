import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Content Flywheel",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
            footerActionLink: "text-orange-500 hover:text-orange-600",
          },
        }}
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}

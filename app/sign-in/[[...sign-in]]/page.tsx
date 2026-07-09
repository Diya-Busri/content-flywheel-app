import type { Metadata } from "next";
import { SignInWithRedirect } from "../sign-in-with-redirect";

export const metadata: Metadata = {
  title: "Sign In | Content Flywheel",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <SignInWithRedirect />
    </div>
  );
}

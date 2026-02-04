import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Content Flywheel",
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

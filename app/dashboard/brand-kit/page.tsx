import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import BrandKitClient from "./BrandKitClient";

export const metadata: Metadata = {
  title: "Brand Kit | Content Flywheel",
  description: "Manage your brand colours, fonts, and logo in one place.",
};

export default function BrandKitPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return <BrandKitClient />;
}

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CaptionLibraryClient from "./CaptionLibraryClient";

export const metadata: Metadata = {
  title: "Caption Library | Content Flywheel",
  description: "Save and reuse your best captions and hashtag sets.",
};

export default function CaptionLibraryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <CaptionLibraryClient />;
}

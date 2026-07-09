import type { Metadata } from "next";
import ContentStudioLibraryClient from "./ContentStudioLibraryClient";

export const metadata: Metadata = {
  title: "My Videos | Content Studio",
  description: "Your Content Studio video library",
};

export default function ContentStudioLibraryPage() {
  return <ContentStudioLibraryClient />;
}

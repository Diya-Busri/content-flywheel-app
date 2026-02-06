/**
 * My Videos - Video library
 */
import type { Metadata } from "next";
import MyVideosFlow from "./MyVideosFlow";

export const metadata: Metadata = {
  title: "My Videos | Content Flywheel",
  description: "View and manage your generated videos",
};

export default function MyVideosPage() {
  return <MyVideosFlow />;
}

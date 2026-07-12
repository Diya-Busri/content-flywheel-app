import type { Metadata } from "next";
import { JarvisClient } from "./JarvisClient";

export const metadata: Metadata = {
  title: "Jarvis — Content Flywheel",
};

export default function JarvisPage() {
  return <JarvisClient />;
}

import type { Metadata } from "next";
import { BundleEditor } from "./BundleEditor";

export const metadata: Metadata = {
  title: "Bundle Editor | Design Studio | Content Flywheel",
};

export default function BundleEditorPage({ params }: { params: { id: string } }) {
  return <BundleEditor bundleId={params.id} />;
}

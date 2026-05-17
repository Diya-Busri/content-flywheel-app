import type { Metadata } from "next";
import { DesignEditor } from "./DesignEditor";

export const metadata: Metadata = {
  title: "Design Editor | Content Flywheel",
};

export default function DesignEditorPage({ params }: { params: { id: string } }) {
  return <DesignEditor designId={params.id} />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignEditor } from "./DesignEditor";

export const metadata: Metadata = {
  title: "Design Editor | Content Flywheel",
};

export default function DesignEditorPage({ params }: { params: { id: string } }) {
  return (
    <Suspense>
      <DesignEditor designId={params.id} />
    </Suspense>
  );
}

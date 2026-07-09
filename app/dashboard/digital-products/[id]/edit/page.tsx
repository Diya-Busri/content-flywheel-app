import type { Metadata } from "next";
import ProductEditor from "./ProductEditor";

export const metadata: Metadata = {
  title: "Edit Product | Digital Products | Content Flywheel",
  description: "Edit and export your digital product",
};

type Props = { params: Promise<{ id: string }> };

export default async function ProductEditPage({ params }: Props) {
  const { id } = await params;
  return <ProductEditor productId={id} />;
}

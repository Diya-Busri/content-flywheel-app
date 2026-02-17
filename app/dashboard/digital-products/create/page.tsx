/**
 * Digital Products - Product details form (Path A: I Know What I Want)
 */
import type { Metadata } from "next";
import CreateFlow from "./CreateFlow";

export const metadata: Metadata = {
  title: "Create Product | Digital Products | Content Flywheel",
  description: "Enter your product details to generate video scripts for your Video Creation Guide",
};

export default function DigitalProductsCreatePage() {
  return <CreateFlow />;
}

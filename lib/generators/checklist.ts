import { jsPDF } from "jspdf";
import type { ProductDetails } from "./types";

export async function generateChecklist(details: ProductDetails): Promise<ArrayBuffer> {
  const doc = new jsPDF();
  const title = details.title || "Checklist";

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(details.description || "Your step-by-step checklist", 20, 35, { maxWidth: 170 });

  let y = 55;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Before You Start", 20, y);
  y += 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const beforeItems = [
    "Gather all necessary materials",
    "Set aside dedicated time",
    "Review the entire checklist",
    "Prepare your workspace",
  ];
  beforeItems.forEach((item) => {
    doc.rect(20, y - 4, 4, 4);
    doc.text(item, 28, y);
    y += 10;
  });

  y += 10;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Main Steps", 20, y);
  y += 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const mainSteps = [
    "Step 1: Initial setup and configuration",
    "Step 2: Core implementation",
    "Step 3: Testing and validation",
    "Step 4: Optimization",
    "Step 5: Launch preparation",
    "Step 6: Go live!",
  ];
  mainSteps.forEach((item) => {
    doc.rect(20, y - 4, 4, 4);
    doc.text(item, 28, y);
    y += 10;
  });

  y += 10;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("After Completion", 20, y);
  y += 15;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const afterItems = ["Review results", "Document lessons learned", "Celebrate your success!"];
  afterItems.forEach((item) => {
    doc.rect(20, y - 4, 4, 4);
    doc.text(item, 28, y);
    y += 10;
  });

  return doc.output("arraybuffer");
}

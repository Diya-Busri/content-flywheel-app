import { jsPDF } from "jspdf";
import type { ProductDetails } from "./types";

export async function generateWorkbook(details: ProductDetails): Promise<ArrayBuffer> {
  const doc = new jsPDF();
  const title = details.title || "Workbook";

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(`${title} Workbook`, 20, 40);

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(details.description || "Your interactive workbook", 20, 55, { maxWidth: 170 });

  doc.addPage();
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Worksheet 1: Self-Assessment", 20, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Rate yourself 1-10 on the following:", 20, 40);

  const questions = [
    "Current knowledge level: _______",
    "Time commitment available: _______",
    "Main goal: _________________________",
    "Biggest challenge: _________________________",
  ];
  let y = 60;
  questions.forEach((q) => {
    doc.text(q, 20, y);
    y += 15;
  });

  doc.addPage();
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Worksheet 2: 30-Day Action Plan", 20, 20);

  y = 40;
  doc.setFontSize(10);
  ["Week 1", "Week 2", "Week 3", "Week 4"].forEach((week) => {
    doc.text(week, 20, y);
    doc.rect(20, y + 5, 170, 30);
    y += 40;
  });

  doc.addPage();
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Worksheet 3: Reflection", 20, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("What went well: _________________________________", 20, 45);
  doc.rect(20, 55, 170, 25);
  doc.text("What I would do differently: ________________________", 20, 95);
  doc.rect(20, 105, 170, 25);
  doc.text("Key takeaway: _____________________________________", 20, 145);
  doc.rect(20, 155, 170, 25);

  return doc.output("arraybuffer");
}

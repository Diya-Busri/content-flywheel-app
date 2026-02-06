import { jsPDF } from "jspdf";
import type { ProductDetails } from "./types";

export async function generateEbook(details: ProductDetails): Promise<ArrayBuffer> {
  const doc = new jsPDF();
  const title = details.title || "Untitled Guide";
  const niche = details.niche || "your topic";
  const sections = details.sections ?? [
    { title: "Introduction", body: `This comprehensive guide will teach you everything you need to know about ${niche}. Whether you're just starting out or looking to improve your skills, this ebook provides practical, actionable advice.` },
    { title: "Getting Started", body: "In this chapter we cover the fundamentals and set you up for success. Follow the steps in order for best results." },
    { title: "Advanced Techniques", body: "Once you have the basics down, these techniques will help you go further and achieve better outcomes." },
    { title: "Case Studies", body: "Real-world examples and applications to illustrate key concepts." },
    { title: "Resources", body: "Further reading, tools, and templates to support your journey." },
  ];

  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, 100, { maxWidth: 170 });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("A comprehensive guide", 20, 120);

  doc.addPage();
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Table of Contents", 20, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  let tocY = 40;
  sections.forEach((s, i) => {
    const pageNum = 3 + i;
    doc.text(`${i + 1}. ${s.title} ${".".repeat(Math.max(0, 35 - s.title.length))} ${pageNum}`, 20, tocY);
    tocY += 10;
  });

  sections.forEach((section, idx) => {
    doc.addPage();
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(`Chapter ${idx + 1}: ${section.title}`, 20, 20, { maxWidth: 170 });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(section.body, 170);
    doc.text(lines, 20, 40);
  });

  return doc.output("arraybuffer");
}

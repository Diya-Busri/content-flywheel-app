import { jsPDF } from "jspdf";
import type { ProductDetails } from "./types";

export async function generateCourseOutline(details: ProductDetails): Promise<ArrayBuffer> {
  const doc = new jsPDF();
  const title = details.title || "Course";
  const description = details.description || "Master the topic";
  const niche = details.niche || "learners";

  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text(title, 20, 60, { maxWidth: 170 });

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("Course Outline & Structure", 20, 90);

  doc.addPage();
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Course Overview", 20, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const overview = `This course teaches ${description}. Designed for ${niche}, it provides a step-by-step path to mastery.`;
  doc.text(doc.splitTextToSize(overview, 170), 20, 35);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Module 1: Foundation", 20, 60);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Lesson 1.1: Introduction (10 min)", 25, 75);
  doc.text("Lesson 1.2: Core Concepts (20 min)", 25, 85);
  doc.text("Lesson 1.3: Getting Started (15 min)", 25, 95);
  doc.text("Quiz: Module 1 Assessment", 25, 105);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Module 2: Implementation", 20, 125);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Lesson 2.1: Step-by-Step Process (25 min)", 25, 140);
  doc.text("Lesson 2.2: Common Mistakes (15 min)", 25, 150);
  doc.text("Lesson 2.3: Best Practices (20 min)", 25, 160);
  doc.text("Project: Apply What You Learned", 25, 170);

  doc.addPage();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Module 3: Advanced Topics", 20, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Lesson 3.1: Deep Dive (30 min)", 25, 35);
  doc.text("Lesson 3.2: Case Studies (20 min)", 25, 45);
  doc.text("Final Project", 25, 55);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Resources & Materials", 20, 85);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("• Downloadable workbook", 25, 100);
  doc.text("• Template files", 25, 110);
  doc.text("• Cheat sheet", 25, 120);
  doc.text("• Bonus: Advanced techniques guide", 25, 130);

  return doc.output("arraybuffer");
}

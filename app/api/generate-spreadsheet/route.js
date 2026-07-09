import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";
import ExcelJS from "exceljs";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Hex color to Excel ARGB string (e.g. #FF6B35 -> "FFFF6B35"). */
function hexToArgb(hex) {
  if (!hex || typeof hex !== "string") return "FF333333";
  const h = hex.replace(/^#/, "");
  if (h.length === 6) return "FF" + h.toUpperCase();
  if (h.length === 8) return h.toUpperCase();
  return "FF333333";
}

/** Parse section content into rows of cell values. Detects tab/comma separation and formulas. */
function parseContentToRows(content) {
  if (!content || typeof content !== "string") return [];
  const lines = content.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.includes("\t")) {
      return trimmed.split(/\t/).map((cell) => parseCellValue(cell.trim()));
    }
    if (trimmed.includes(",")) {
      return parseCsvLine(trimmed).map((cell) => parseCellValue(cell.trim()));
    }
    return [parseCellValue(trimmed)];
  });
}

function parseCellValue(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (s.startsWith("=") && s.length > 1) return { formula: s.slice(1) };
  const num = Number(s);
  if (s !== "" && !Number.isNaN(num)) return num;
  return s;
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

/** Sanitize sheet name (Excel has 31-char limit, no : \ / ? * [ ]). */
function safeSheetName(title, index) {
  const base = (title || `Section ${index + 1}`).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28);
  return base || `Section ${index + 1}`;
}

/** Strip HTML and markdown to plain text for instructions. */
function toPlainText(content) {
  if (!content || typeof content !== "string") return "";
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/##\s+/g, "")
    .replace(/#\s+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * POST /api/generate-spreadsheet
 * Body: { productId: string }
 * Returns .xlsx file: Sheet 1 = cover, Sheet 2+ = one per section.
 */
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const title = product?.title ?? "Product";
    const description = product?.description ?? product?.subtitle ?? product?.tagline ?? "";
    const sections = product?.content?.sections ?? [];
    const secs = sections.length ? sections : [{ id: "1", title: title, content: "" }];
    const ds = product?.designSettings ?? {};
    const accentHex = ds?.colors?.graphics ?? "#FF6B35";
    const argb = hexToArgb(accentHex);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Content Flywheel";
    workbook.created = new Date();

    // Sheet 1: Cover/Instructions
    const coverSheet = workbook.addWorksheet("Cover", {
      properties: { tabColor: { argb } },
      pageSetup: { fitToPage: true, printTitlesRow: "1:1" },
    });
    coverSheet.columns = [{ key: "a", width: 50 }];
    coverSheet.getColumn(1).width = 50;

    // Row 1: Product title (large, bold, centered, colored)
    const coverTitleRow = coverSheet.getRow(1);
    coverTitleRow.getCell(1).value = title;
    coverTitleRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb },
    };
    coverTitleRow.getCell(1).font = { size: 20, bold: true, color: { argb: "FFFFFFFF" } };
    coverTitleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    coverTitleRow.height = 32;

    // Row 3: Description/intro
    const descRow = coverSheet.getRow(3);
    descRow.getCell(1).value = description;
    descRow.getCell(1).font = { size: 12 };
    descRow.getCell(1).alignment = { wrapText: true };
    descRow.height = description ? Math.max(20, (description.length / 50) * 14) : 20;

    // Row 5: "How to use this spreadsheet"
    const howToRow = coverSheet.getRow(5);
    howToRow.getCell(1).value = "How to use this spreadsheet";
    howToRow.getCell(1).font = { size: 14, bold: true };
    howToRow.height = 22;

    // Row 7: Instructions from first section content
    const firstSectionContent = secs[0]?.content ?? "";
    const instructionsText = toPlainText(firstSectionContent) || "Use the tabs below to work through each section.";
    const instructionsRow = coverSheet.getRow(7);
    instructionsRow.getCell(1).value = instructionsText;
    instructionsRow.getCell(1).font = { size: 11 };
    instructionsRow.getCell(1).alignment = { wrapText: true };
    instructionsRow.height = Math.max(24, Math.ceil(instructionsText.length / 60) * 14);

    // Sheet 2+: One per section
    secs.forEach((section, index) => {
      const sheetName = safeSheetName(section.title, index);
      const ws = workbook.addWorksheet(sheetName, {
        properties: { tabColor: { argb } },
        pageSetup: { fitToPage: true },
      });

      const sectionTitle = section.title || `Section ${index + 1}`;
      const headerRow = ws.getRow(1);
      headerRow.getCell(1).value = sectionTitle;
      headerRow.getCell(1).font = { size: 14, bold: true };
      headerRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb },
      };
      headerRow.getCell(1).font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.height = 22;

      const rows = parseContentToRows(section.content ?? "");
      if (rows.length === 0) {
        ws.getRow(2).getCell(1).value = "(No content)";
      } else {
        rows.forEach((rowCells, r) => {
          const row = ws.getRow(r + 2);
          rowCells.forEach((cellVal, c) => {
            const cell = row.getCell(c + 1);
            if (cellVal != null && typeof cellVal === "object" && "formula" in cellVal) {
              cell.value = { formula: cellVal.formula };
              cell.font = { size: 11 };
            } else {
              cell.value = cellVal;
              cell.font = { size: 11 };
            }
          });
        });
      }

      // Column widths from first few rows
      let maxCol = 1;
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber > maxCol) maxCol = colNumber;
        });
      }
      for (let c = 1; c <= maxCol; c++) {
        ws.getColumn(c).width = Math.min(40, Math.max(12, ws.getColumn(c).width || 15));
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const safeName = title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "product";
    const fileName = `${safeName}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Generate spreadsheet failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Spreadsheet generation failed" },
      { status: 500 }
    );
  }
}

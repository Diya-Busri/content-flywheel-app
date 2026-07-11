import type { ProductDetails } from "./types";

// ── HTML parsing helpers ─────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseHtmlTable(html: string): ParsedTable | null {
  const tableMatch = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!tableMatch) return null;
  const tableHtml = tableMatch[1];

  const headers: string[] = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let m;
  while ((m = thRegex.exec(tableHtml)) !== null) {
    const h = stripHtml(m[1]);
    if (h) headers.push(h);
  }

  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  while ((m = trRegex.exec(tableHtml)) !== null) {
    const rowHtml = m[1];
    if (/<th/i.test(rowHtml)) continue;
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRegex.exec(rowHtml)) !== null) {
      cells.push(stripHtml(td[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }

  return headers.length > 0 ? { headers, rows } : null;
}

function extractFormulas(html: string): string[] {
  const formulas: string[] = [];
  const codeRegex = /<code[^>]*>([\s\S]*?)<\/code>/gi;
  let m;
  while ((m = codeRegex.exec(html)) !== null) {
    const text = stripHtml(m[1]).trim();
    if (text.startsWith("=")) formulas.push(text);
  }
  return formulas;
}

function sectionPlainText(html: string): string[] {
  return html
    .replace(/<table[\s\S]*?<\/table>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .split("\n")
    .map((l) => l.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim())
    .filter(Boolean);
}

// ── Colour palette ───────────────────────────────────────────────────────────

const ORANGE = "FFF97316";
const ORANGE_LIGHT = "FFFFF7ED";
const WHITE = "FFFFFFFF";
const DARK = "FF1F2937";
const GREY_BORDER = "FFD1D5DB";
const ROW_ALT = "FFF9FAFB";

// ── Main generator ───────────────────────────────────────────────────────────

export async function generateSpreadsheet(details: ProductDetails): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Content Flywheel";
  workbook.created = new Date();

  const title = details.title || "Spreadsheet";
  const sections = details.sections || [];

  const FIXED_IDS = new Set(["outcome-promise", "fast-start", "framework", "disclaimer"]);

  // Separate sections: instructions vs data tabs
  const instructionSections = sections.filter(
    (s) => FIXED_IDS.has(s.title?.toLowerCase().replace(/\s+/g, "-")) ||
      /^(outcome|quick wins|framework|disclaimer|overview|introduction|tips|getting started|how to use|setup|formula guide)/i.test(s.title)
  );
  const dataSections = sections.filter((s) => !instructionSections.includes(s));

  // ── Tab 1: Instructions ──────────────────────────────────────────────────
  const instructions = workbook.addWorksheet("📋 How to Use", {
    properties: { tabColor: { argb: ORANGE } },
  });
  instructions.getColumn(1).width = 3;
  instructions.getColumn(2).width = 80;

  // Title banner
  const titleRow = instructions.addRow(["", title]);
  titleRow.height = 48;
  const titleCell = titleRow.getCell(2);
  titleCell.font = { bold: true, size: 20, color: { argb: WHITE } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
  titleCell.alignment = { vertical: "middle", wrapText: false };

  instructions.addRow([]);

  const subRow = instructions.addRow(["", "📖 Getting Started"]);
  subRow.getCell(2).font = { bold: true, size: 13, color: { argb: ORANGE } };
  subRow.height = 22;

  instructions.addRow([]);

  // What's in this spreadsheet
  const tabNames = dataSections.map((s) => `• ${s.title}`);
  if (tabNames.length) {
    const sheetListRow = instructions.addRow(["", "This workbook contains the following tabs:"]);
    sheetListRow.getCell(2).font = { bold: true, size: 11, color: { argb: DARK } };
    tabNames.forEach((name) => {
      const r = instructions.addRow(["", name]);
      r.getCell(2).font = { size: 11, color: { argb: DARK } };
      r.height = 18;
    });
    instructions.addRow([]);
  }

  // Instruction sections content
  const srcSections = instructionSections.length > 0 ? instructionSections : sections.slice(0, 2);
  for (const section of srcSections) {
    const hRow = instructions.addRow(["", section.title]);
    hRow.height = 24;
    const hCell = hRow.getCell(2);
    hCell.font = { bold: true, size: 12, color: { argb: ORANGE } };
    hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_LIGHT } };

    const lines = sectionPlainText(section.body);
    for (const line of lines.slice(0, 20)) {
      const r = instructions.addRow(["", line]);
      r.getCell(2).font = { size: 10, color: { argb: DARK } };
      r.getCell(2).alignment = { wrapText: true };
      r.height = 16;
    }
    instructions.addRow([]);
  }

  // ── Data tabs: one per section with a table ──────────────────────────────
  for (const section of dataSections) {
    const parsed = parseHtmlTable(section.body);
    const formulas = extractFormulas(section.body);
    const sheetName = section.title.replace(/[*?:\\/\[\]]/g, "").slice(0, 31);

    const ws = workbook.addWorksheet(sheetName, {
      properties: { tabColor: { argb: ORANGE } },
    });

    if (parsed && parsed.headers.length > 0) {
      // Set column widths
      parsed.headers.forEach((h, i) => {
        ws.getColumn(i + 1).width = Math.max(14, Math.min(35, h.length + 6));
      });

      // Header row
      const headerRow = ws.addRow(parsed.headers);
      headerRow.height = 28;
      headerRow.eachCell((cell, colNum) => {
        if (colNum <= parsed.headers.length) {
          cell.font = { bold: true, size: 11, color: { argb: WHITE } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border = {
            bottom: { style: "medium", color: { argb: ORANGE_LIGHT } },
            right: { style: "thin", color: { argb: GREY_BORDER } },
          };
        }
      });

      // Sample data rows
      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const dr = ws.addRow(row);
        dr.height = 20;
        const isAlt = i % 2 === 1;
        dr.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (colNum <= parsed.headers.length) {
            if (isAlt) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ALT } };
            }
            cell.border = {
              bottom: { style: "thin", color: { argb: GREY_BORDER } },
              right: { style: "thin", color: { argb: GREY_BORDER } },
            };
            cell.font = { size: 10, color: { argb: DARK } };
          }
        });
      }

      // 40 blank rows for user data
      const sampleCount = parsed.rows.length;
      for (let i = 0; i < 40; i++) {
        const blank = ws.addRow(Array(parsed.headers.length).fill(""));
        blank.height = 20;
        const isAlt = (sampleCount + i) % 2 === 1;
        blank.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (colNum <= parsed.headers.length) {
            if (isAlt) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ALT } };
            }
            cell.border = {
              bottom: { style: "thin", color: { argb: GREY_BORDER } },
              right: { style: "thin", color: { argb: GREY_BORDER } },
            };
          }
        });
      }

      // Auto-filter
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: parsed.headers.length },
      };

      // Freeze header row
      ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

      // Formulas section below data
      if (formulas.length > 0) {
        ws.addRow([]);
        const fHeaderRow = ws.addRow(["📐 Useful Formulas"]);
        fHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: ORANGE } };
        fHeaderRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE_LIGHT } };

        for (const formula of formulas) {
          const fRow = ws.addRow([formula]);
          fRow.getCell(1).font = { size: 10, color: { argb: DARK }, name: "Courier New" };
        }
      }
    } else {
      // Section has no table — show plain text content
      ws.getColumn(1).width = 80;
      const hRow = ws.addRow([section.title]);
      hRow.height = 28;
      hRow.getCell(1).font = { bold: true, size: 14, color: { argb: WHITE } };
      hRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
      ws.addRow([]);

      const lines = sectionPlainText(section.body);
      for (const line of lines.slice(0, 50)) {
        const r = ws.addRow([line]);
        r.getCell(1).font = { size: 10, color: { argb: DARK } };
        r.getCell(1).alignment = { wrapText: true };
        r.height = 16;
      }
    }
  }

  // If no data sections had tables, fall back to a generic template
  if (dataSections.length === 0 || dataSections.every((s) => !parseHtmlTable(s.body))) {
    const template = workbook.addWorksheet("📊 Template", {
      properties: { tabColor: { argb: "FF2C3E50" } },
    });
    const defaultCols = ["Date", "Description", "Category", "Amount", "Status", "Notes"];
    template.columns = defaultCols.map((col) => ({
      header: col,
      key: col.toLowerCase(),
      width: 18,
    }));
    const headerRow = template.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    for (let r = 0; r < 50; r++) {
      template.addRow(Array(defaultCols.length).fill("")).height = 20;
    }
    template.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: defaultCols.length } };
    template.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

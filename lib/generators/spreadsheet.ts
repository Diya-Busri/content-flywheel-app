import type { ProductDetails } from "./types";

export async function generateSpreadsheet(details: ProductDetails): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const title = details.title || "Spreadsheet Tutorial";
  const sections = details.sections || [];

  // ── Sheet 1: Tutorial Guide ──────────────────────────────────────────────
  const guide = workbook.addWorksheet("📖 Tutorial Guide", {
    properties: { tabColor: { argb: "FFF97316" } },
  });

  guide.getColumn(1).width = 4;   // left margin
  guide.getColumn(2).width = 90;  // content

  // Title banner
  const titleRow = guide.addRow(["", title]);
  titleRow.height = 44;
  const titleCell = titleRow.getCell(2);
  titleCell.font = { bold: true, size: 22, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } };
  titleCell.alignment = { vertical: "middle" };

  guide.addRow([]); // spacer

  // Sections
  sections.forEach((section, i) => {
    // Section heading
    const headingRow = guide.addRow(["", `${i + 1}. ${section.title}`]);
    headingRow.height = 26;
    const headingCell = headingRow.getCell(2);
    headingCell.font = { bold: true, size: 13, color: { argb: "FFF97316" } };
    headingCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
    headingCell.alignment = { vertical: "middle" };

    // Section body — strip HTML and split into lines
    const lines = section.body
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    lines.forEach((line) => {
      const bodyRow = guide.addRow(["", line]);
      bodyRow.height = 18;
      const bodyCell = bodyRow.getCell(2);
      bodyCell.font = { size: 11, color: { argb: "FF374151" } };
      bodyCell.alignment = { wrapText: true, vertical: "top" };
    });

    guide.addRow([]); // spacer after section
  });

  // ── Sheet 2: Template ────────────────────────────────────────────────────
  const template = workbook.addWorksheet("📋 Template", {
    properties: { tabColor: { argb: "FF2C3E50" } },
  });

  // Pick relevant columns based on the product title
  const titleLower = title.toLowerCase();
  let columns: string[];

  if (/budget|expense|financ|money|spend|cost/.test(titleLower)) {
    columns = ["Date", "Description", "Category", "Amount (£)", "Type", "Notes"];
  } else if (/project|task|todo|plan|roadmap/.test(titleLower)) {
    columns = ["Task", "Assignee", "Priority", "Status", "Due Date", "Done?", "Notes"];
  } else if (/sales|revenue|crm|client|lead|deal/.test(titleLower)) {
    columns = ["Date", "Client", "Product/Service", "Amount (£)", "Stage", "Follow-up", "Notes"];
  } else if (/inventor|stock|product|warehouse/.test(titleLower)) {
    columns = ["Item Name", "SKU", "Qty In Stock", "Unit Price (£)", "Total Value", "Location", "Notes"];
  } else if (/habit|goal|routine|daily|weekly/.test(titleLower)) {
    columns = ["Date", "Habit / Goal", "Target", "Actual", "% Complete", "Streak", "Notes"];
  } else if (/content|social|post|schedule|calendar/.test(titleLower)) {
    columns = ["Date", "Platform", "Content Type", "Topic / Caption", "Status", "Engagement", "Notes"];
  } else if (/invoice|billing|payment|client/.test(titleLower)) {
    columns = ["Invoice #", "Client", "Date Issued", "Due Date", "Amount (£)", "Status", "Notes"];
  } else if (/employee|staff|hr|rota|shift/.test(titleLower)) {
    columns = ["Employee", "Role", "Hours", "Rate (£)", "Total Pay", "Week", "Notes"];
  } else {
    columns = ["Date", "Name / Item", "Category", "Value", "Status", "Notes"];
  }

  template.columns = columns.map((col) => ({
    header: col,
    key: col.toLowerCase().replace(/[\s/()£#?!]/g, "_"),
    width: col.length <= 8 ? 13 : col.length <= 16 ? 20 : 26,
  }));

  // Style header row
  const headerRow = template.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFE4C4" } } };
  });

  // 20 alternating data rows
  for (let r = 0; r < 20; r++) {
    const dataRow = template.addRow(
      columns.map(() => "")
    );
    dataRow.height = 20;
    if (r % 2 === 0) {
      dataRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (colNum <= columns.length) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
        }
      });
    }
  }

  // Auto-filter on header
  template.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // ── Sheet 3: Notes ───────────────────────────────────────────────────────
  const notes = workbook.addWorksheet("📝 Notes", {
    properties: { tabColor: { argb: "FF27AE60" } },
  });
  notes.getColumn(1).width = 70;

  const notesTitle = notes.addRow([`Notes — ${title}`]);
  notesTitle.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  notesTitle.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } };
  notesTitle.height = 30;

  for (let i = 0; i < 30; i++) {
    const row = notes.addRow([""]);
    row.height = 20;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

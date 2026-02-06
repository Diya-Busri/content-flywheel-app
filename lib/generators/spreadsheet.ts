import type { ProductDetails } from "./types";

export async function generateSpreadsheet(details: ProductDetails): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const title = details.title || "Tracker";

  const sheet1 = workbook.addWorksheet("Summary", { properties: { tabColor: { argb: "FF6B35" } } });
  sheet1.columns = [
    { header: "Category", key: "category", width: 20 },
    { header: "Budgeted", key: "budgeted", width: 12 },
    { header: "Actual", key: "actual", width: 12 },
    { header: "Difference", key: "difference", width: 12 },
  ];
  sheet1.addRow({ category: "Transport", budgeted: 500, actual: 0, difference: "=B2-C2" });
  sheet1.addRow({ category: "Accommodation", budgeted: 800, actual: 0, difference: "=B3-C3" });
  sheet1.addRow({ category: "Food", budgeted: 300, actual: 0, difference: "=B4-C4" });
  sheet1.addRow({ category: "Activities", budgeted: 400, actual: 0, difference: "=B5-C5" });
  sheet1.addRow({ category: "Total", budgeted: "=SUM(B2:B5)", actual: "=SUM(C2:C5)", difference: "=B6-C6" });
  sheet1.getRow(1).font = { bold: true };

  const sheet2 = workbook.addWorksheet("Monthly", { properties: { tabColor: { argb: "2C3E50" } } });
  sheet2.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 25 },
    { header: "Category", key: "category", width: 15 },
    { header: "Amount", key: "amount", width: 12 },
  ];
  for (let i = 1; i <= 10; i++) {
    sheet2.addRow({ date: "", description: "", category: "", amount: "" });
  }
  sheet2.getRow(1).font = { bold: true };

  const sheet3 = workbook.addWorksheet("Notes", { properties: { tabColor: { argb: "27AE60" } } });
  sheet3.columns = [{ header: "Notes", key: "notes", width: 50 }];
  sheet3.addRow({ notes: "Add your notes here..." });
  sheet3.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

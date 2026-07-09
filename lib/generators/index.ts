import type { ProductType, ProductDetails } from "./types";
import { generateEbook } from "./ebook";
import { generateWorkbook } from "./workbook";
import { generateSpreadsheet } from "./spreadsheet";
import { generateNotionTemplate } from "./notion";
import { generateCourseOutline } from "./course";
import { generateChecklist } from "./checklist";

export type { ProductType, ProductDetails } from "./types";
export type { NotionTemplateResult } from "./notion";

export type GenerateProductResult = ArrayBuffer | Awaited<ReturnType<typeof generateNotionTemplate>>;

const VALID_FORMATS: ProductType[] = ["ebook", "workbook", "spreadsheet", "notion", "course", "checklist"];

export function isValidProductType(value: string): value is ProductType {
  return VALID_FORMATS.includes(value as ProductType);
}

export async function generateProduct(
  type: ProductType,
  productDetails: ProductDetails
): Promise<GenerateProductResult> {
  if (!type || typeof type !== "string") {
    throw new Error("Product format is required. Received: " + String(type));
  }
  if (!isValidProductType(type)) {
    throw new Error(`Invalid product format: "${type}". Must be one of: ${VALID_FORMATS.join(", ")}`);
  }

  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    console.log("Generating product with format:", type);
  }

  switch (type) {
    case "ebook":
      return await generateEbook(productDetails);
    case "workbook":
      return await generateWorkbook(productDetails);
    case "spreadsheet":
      return await generateSpreadsheet(productDetails);
    case "notion":
      return await generateNotionTemplate(productDetails);
    case "course":
      return await generateCourseOutline(productDetails);
    case "checklist":
      return await generateChecklist(productDetails);
    default:
      throw new Error(`Unknown product type: ${type}`);
  }
}

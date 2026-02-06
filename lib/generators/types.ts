export type ProductType =
  | "ebook"
  | "workbook"
  | "spreadsheet"
  | "notion"
  | "course"
  | "checklist";

export interface ProductDetails {
  title: string;
  description?: string;
  niche?: string;
  sections?: Array<{ title: string; body: string }>;
}

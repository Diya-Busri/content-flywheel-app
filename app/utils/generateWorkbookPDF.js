import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";

const SECTION_ORANGE = "#FF6B35";

/**
 * Strip HTML to plain text for PDF body (react-pdf Text doesn't render HTML).
 */
function stripHtml(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const styles = StyleSheet.create({
  coverPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  coverTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#111",
  },
  page: {
    padding: 60,
    paddingTop: 48,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: SECTION_ORANGE,
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: SECTION_ORANGE,
    paddingBottom: 8,
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "#000",
    marginBottom: 14,
  },
  bodyBlock: {
    marginTop: 4,
  },
});

/**
 * PDF Document: cover + one page per section.
 */
function WorkbookPDFDocument({ productTitle, sections }) {
  const title = productTitle || "Workbook";
  const list = Array.isArray(sections) && sections.length > 0
    ? sections
    : [{ title: "(Untitled)", content: "" }];

  return (
    <Document>
      <Page size="A4" style={styles.coverPage}>
        <View>
          <Text style={styles.coverTitle}>{title}</Text>
        </View>
      </Page>

      {list.map((section, index) => (
        <Page key={section.id ?? index} size="A4" style={styles.page}>
          <View>
            <Text style={styles.sectionTitle}>
              {section.title || "(Untitled)"}
            </Text>
            <View style={styles.bodyBlock}>
              <Text style={styles.bodyText}>
                {stripHtml(section.contentHtml ?? section.content ?? "") || "(Empty)"}
              </Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}

/**
 * Generate a PDF blob from workbook data.
 * Uses pdf() from @react-pdf/renderer (equivalent to render + toBlob).
 *
 * @param {Object} productData
 * @param {string} productData.title - Product/workbook title (cover)
 * @param {Array<{ title: string, content?: string, contentHtml?: string }>} productData.sections
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateWorkbookPDF(productData) {
  if (!productData || typeof productData !== "object") {
    throw new Error("productData is required");
  }
  const { title, sections } = productData;
  const blob = await pdf(
    <WorkbookPDFDocument productTitle={title} sections={sections} />
  ).toBlob();
  return blob;
}

/**
 * Generate a PDF buffer for server/API (Node).
 * @param {Object} productData - Same as generateWorkbookPDF
 * @returns {Promise<Buffer>}
 */
export async function generateWorkbookPDFToBuffer(productData) {
  if (!productData || typeof productData !== "object") {
    throw new Error("productData is required");
  }
  const { title, sections } = productData;
  return pdf(
    <WorkbookPDFDocument productTitle={title} sections={sections} />
  ).toBuffer();
}

export { WorkbookPDFDocument, styles };

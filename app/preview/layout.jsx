/**
 * Minimal layout for /preview/[productId] - no nav, no chrome.
 * Used by Puppeteer for PDF capture.
 */
export default function PreviewLayout({ children }) {
  return (
    <div style={{ margin: 0, padding: 0, minHeight: "100vh" }}>
      {children}
    </div>
  );
}

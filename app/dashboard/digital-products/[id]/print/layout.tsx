/**
 * Print view layout: full-viewport overlay so dashboard sidebar is not visible.
 * In print: no scroll container – each .print-page is a separate sheet.
 */
import { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <div className="print-view-root fixed inset-0 z-[100] bg-gray-100 overflow-auto print:relative print:z-auto print:overflow-visible print:h-auto print:min-h-0">
      {children}
    </div>
  );
}

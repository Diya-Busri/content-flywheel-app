"use client";

import { useState } from "react";

type Section = { id?: string; title: string; content?: string; order?: number };
type DescBlock = { type: "p" | "ul" | "heading+ul"; text?: string; heading?: string; items?: string[] };

function TextContentPreview({ descParagraphs, sections }: { descParagraphs: string[]; sections: Section[] }) {
  const intro = descParagraphs[0]?.replace(/\*\*/g, "").trim() ?? "";
  const preview = intro.length > 320 ? intro.slice(0, 320) + "…" : intro;
  return (
    <div style={{ padding: "24px", background: "linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fdf2f8 100%)", minHeight: "300px" }}>
      {preview && (
        <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#374151", lineHeight: 1.75, fontStyle: "italic" }}>
          &ldquo;{preview}&rdquo;
        </p>
      )}
      {sections.length > 0 && (
        <>
          <p style={{ margin: "0 0 10px", fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            What&rsquo;s inside
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sections.slice(0, 6).map((s, i) => (
              <div key={s.id ?? i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "10px", fontWeight: 700, color: "#fff" }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#374151" }}>{s.title}</span>
              </div>
            ))}
            {sections.length > 6 && (
              <p style={{ margin: "4px 0 0 30px", fontSize: "12px", color: "#9ca3af" }}>+ {sections.length - 6} more sections</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function parseDescBlocks(paragraphs: string[]): DescBlock[] {
  const blocks: DescBlock[] = [];
  for (const para of paragraphs) {
    const clean = para.replace(/\*\*/g, "").trim();
    if (!clean) continue;
    // "Heading: - item - item" pattern
    if (/ - /.test(clean) && clean.indexOf(": - ") !== -1) {
      const colonIdx = clean.indexOf(": - ");
      blocks.push({
        type: "heading+ul",
        heading: clean.slice(0, colonIdx + 1),
        items: clean.slice(colonIdx + 2).split(/ - /).map((s) => s.trim()).filter(Boolean),
      });
    } else if (/\n\s*[-•]\s/.test(clean)) {
      const lines = clean.split(/\n/);
      const heading = lines[0].replace(/[-•]\s/, "").trim();
      const items = lines.slice(1).map((l) => l.replace(/^[\s\-•]+/, "").trim()).filter(Boolean);
      blocks.push({ type: "heading+ul", heading, items });
    } else {
      blocks.push({ type: "p", text: clean });
    }
  }
  return blocks;
}

type Props = {
  previewPageUrl: string | null;
  sections: Section[];
  descParagraphs: string[];
  testimonials?: Array<{ name: string; text: string; rating?: number }>;
};

const TABS = [
  { id: "preview", label: "👁 Preview" },
  { id: "contents", label: "📋 Contents" },
  { id: "about", label: "ℹ About" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProductInfoTabs({ previewPageUrl, sections, descParagraphs, testimonials }: Props) {
  const hasTextPreview = descParagraphs.length > 0 || sections.length > 0;
  const hasPreviewTab = !!previewPageUrl || hasTextPreview;
  const defaultTab: TabId = hasPreviewTab ? "preview" : sections.length > 0 ? "contents" : "about";
  const [active, setActive] = useState<TabId>(defaultTab);

  const availableTabs = TABS.filter((t) => {
    if (t.id === "preview") return hasPreviewTab;
    if (t.id === "contents") return sections.length > 0;
    if (t.id === "about") return descParagraphs.length > 0 || (testimonials && testimonials.length > 0);
    return false;
  });

  if (availableTabs.length === 0) return null;

  const descBlocks = parseDescBlocks(descParagraphs);

  return (
    <div style={{ background: "#fff", borderRadius: "20px", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "0 4px" }}>
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            style={{
              flex: 1,
              padding: "14px 8px",
              fontSize: "13px",
              fontWeight: active === tab.id ? 700 : 500,
              color: active === tab.id ? "#f97316" : "#6b7280",
              background: "none",
              border: "none",
              borderBottom: active === tab.id ? "2.5px solid #f97316" : "2.5px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s",
              letterSpacing: "0.01em",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel: Preview */}
      {active === "preview" && (
        <div style={{ position: "relative" }}>
          {/* Always show text preview as base — reliable regardless of capture status */}
          <TextContentPreview descParagraphs={descParagraphs} sections={sections} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "160px", background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.98))", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "20px", left: 0, right: 0, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>You&apos;re seeing a preview — purchase to get full access</p>
            <a
              href="#buy"
              style={{ display: "inline-block", padding: "10px 24px", borderRadius: "10px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(249,115,22,0.35)" }}
            >
              Get instant access →
            </a>
          </div>
        </div>
      )}

      {/* Panel: Contents */}
      {active === "contents" && sections.length > 0 && (
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sections.map((s, i) => (
              <div key={s.id ?? i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", background: "#fafafa", border: "1px solid #f3f4f6" }}>
                <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#fff7ed", border: "1.5px solid #fed7aa", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "11px", fontWeight: 700, color: "#f97316" }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151", lineHeight: 1.4 }}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel: About */}
      {active === "about" && (
        <div style={{ padding: "20px 24px" }}>
          {descBlocks.map((block, i) => {
            if (block.type === "heading+ul") {
              return (
                <div key={i} style={{ marginBottom: "14px" }}>
                  {block.heading && <p style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>{block.heading}</p>}
                  <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {block.items?.map((item, j) => (
                      <li key={j} style={{ fontSize: "14px", color: "#374151", lineHeight: 1.6 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            }
            return (
              <p key={i} style={{ margin: "0 0 12px", fontSize: "14px", color: "#374151", lineHeight: 1.7 }}>{block.text}</p>
            );
          })}

          {testimonials && testimonials.length > 0 && (
            <div style={{ marginTop: "20px", borderTop: "1px solid #f3f4f6", paddingTop: "20px" }}>
              <p style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>What customers say</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {testimonials.map((t, i) => (
                  <div key={i} style={{ padding: "14px", background: "#fafafa", borderRadius: "12px", border: "1px solid #f3f4f6" }}>
                    {t.rating && <div style={{ marginBottom: "6px", color: "#f97316" }}>{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</div>}
                    <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#374151", lineHeight: 1.6, fontStyle: "italic" }}>&ldquo;{t.text}&rdquo;</p>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: "#111827" }}>— {t.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

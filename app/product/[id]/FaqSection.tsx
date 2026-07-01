"use client";

import { useState } from "react";

type Faq = { q: string; a: string };

const DEFAULT_FAQS: Faq[] = [
  { q: "What format will I receive?", a: "You'll receive an instant digital download. The format depends on the product type — PDF, EPUB, or similar. Check the product badge above for the exact format." },
  { q: "Can I print it?", a: "Yes — all our digital products are printer-friendly. Simply open the file and print from any device." },
  { q: "How do I access my purchase?", a: "After checkout you'll receive an email with your secure download link. Links are valid for 7 days. You can also access your purchases at any time via your buyer portal." },
  { q: "Does it work on mobile?", a: "Absolutely. PDFs and digital files open in any browser or PDF reader on iPhone, Android, or tablet." },
  { q: "What is your refund policy?", a: "We offer a 30-day money-back guarantee. If you're not happy, contact us and we'll make it right." },
];

export function FaqSection({ customFaqs }: { customFaqs?: Faq[] }) {
  const faqs = (customFaqs && customFaqs.length > 0) ? customFaqs : DEFAULT_FAQS;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ background: "#fff", borderRadius: "20px", padding: "24px 28px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", marginBottom: "24px" }}>
      <h2 style={{ margin: "0 0 18px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>Frequently asked questions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {faqs.map((faq, i) => (
          <div key={i} style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #f3f4f6" }}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "12px", padding: "14px 16px", background: open === i ? "#fafafa" : "#fff",
                border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>{faq.q}</span>
              <span style={{ fontSize: "18px", color: "#f97316", flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(45deg)" : "none" }}>+</span>
            </button>
            {open === i && (
              <div style={{ padding: "0 16px 14px", background: "#fafafa" }}>
                <p style={{ margin: 0, fontSize: "14px", color: "#6b7280", lineHeight: 1.65 }}>{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

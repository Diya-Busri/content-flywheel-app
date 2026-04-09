"use client";
import { useState } from "react";

type Step = {
  id: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
};

type Sequence = {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  steps: Step[];
};

export default function EmailSequencesClient({ initialSequences }: { initialSequences: Sequence[] }) {
  const [sequences, setSequences] = useState<Sequence[]>(initialSequences);
  const [selected, setSelected] = useState<Sequence | null>(initialSequences[0] ?? null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [stepForm, setStepForm] = useState({ delayDays: "0", subject: "", body: "" });
  const [addingStep, setAddingStep] = useState(false);
  const [showStepForm, setShowStepForm] = useState(false);

  async function createSequence() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/email-sequences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const created = await res.json();
      const seq = { ...created, steps: [] };
      setSequences((s) => [seq, ...s]);
      setSelected(seq);
      setNewName("");
    }
    setCreating(false);
  }

  async function toggleActive(seq: Sequence) {
    const res = await fetch(`/api/email-sequences/${seq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !seq.active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSequences((s) => s.map((x) => x.id === seq.id ? { ...x, active: updated.active } : x));
      if (selected?.id === seq.id) setSelected((s) => s ? { ...s, active: updated.active } : s);
    }
  }

  async function deleteSequence(seq: Sequence) {
    if (!confirm(`Delete "${seq.name}"? This cannot be undone.`)) return;
    await fetch(`/api/email-sequences/${seq.id}`, { method: "DELETE" });
    setSequences((s) => s.filter((x) => x.id !== seq.id));
    setSelected((prev) => prev?.id === seq.id ? null : prev);
  }

  async function addStep() {
    if (!selected || !stepForm.subject || !stepForm.body) return;
    setAddingStep(true);
    const res = await fetch(`/api/email-sequences/${selected.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayDays: parseInt(stepForm.delayDays) || 0, subject: stepForm.subject, body: stepForm.body }),
    });
    if (res.ok) {
      const step = await res.json();
      const updated = { ...selected, steps: [...selected.steps, step] };
      setSelected(updated);
      setSequences((s) => s.map((x) => x.id === selected.id ? updated : x));
      setStepForm({ delayDays: "0", subject: "", body: "" });
      setShowStepForm(false);
    }
    setAddingStep(false);
  }

  async function deleteStep(stepId: string) {
    if (!selected) return;
    await fetch(`/api/email-sequences/${selected.id}/steps`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    });
    const updated = { ...selected, steps: selected.steps.filter((s) => s.id !== stepId) };
    setSelected(updated);
    setSequences((s) => s.map((x) => x.id === selected.id ? updated : x));
  }

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1100px" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 800, color: "#111827" }}>📨 Email Sequences</h1>
      <p style={{ margin: "0 0 28px", fontSize: "14px", color: "#6b7280" }}>Build automated drip campaigns. Create a sequence, add steps with delays, enrol subscribers.</p>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left panel — sequence list */}
        <div>
          {/* New sequence */}
          <div style={{ background: "#fff", borderRadius: "14px", padding: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: "16px" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createSequence()}
              placeholder="New sequence name…"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box", marginBottom: "10px" }}
            />
            <button onClick={createSequence} disabled={creating || !newName.trim()}
              style={{ width: "100%", padding: "9px", borderRadius: "8px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer" }}>
              {creating ? "Creating…" : "+ New Sequence"}
            </button>
          </div>

          {sequences.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", padding: "16px" }}>No sequences yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sequences.map((seq) => (
                <button
                  key={seq.id}
                  onClick={() => setSelected(seq)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: `2px solid ${selected?.id === seq.id ? "#f97316" : "transparent"}`,
                    background: selected?.id === seq.id ? "#fff7ed" : "#fff",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#111827", marginBottom: "4px" }}>{seq.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}</span>
                    <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: "999px", fontSize: "10px", fontWeight: 700,
                      background: seq.active ? "#f0fdf4" : "#f9fafb",
                      color: seq.active ? "#16a34a" : "#9ca3af",
                      border: `1px solid ${seq.active ? "#86efac" : "#e5e7eb"}` }}>
                      {seq.active ? "Active" : "Paused"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right panel — steps */}
        {selected ? (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#111827" }}>{selected.name}</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => toggleActive(selected)}
                  style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${selected.active ? "#e5e7eb" : "#86efac"}`, background: selected.active ? "#f9fafb" : "#f0fdf4", color: selected.active ? "#6b7280" : "#16a34a", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  {selected.active ? "⏸ Pause" : "▶ Activate"}
                </button>
                <button onClick={() => deleteSequence(selected)}
                  style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Timeline */}
            {selected.steps.length === 0 && !showStepForm && (
              <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af", fontSize: "14px" }}>
                No steps yet. Add your first email below.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {selected.steps.map((step, i) => (
                <div key={step.id} style={{ display: "flex", gap: "14px" }}>
                  {/* Timeline dot */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#fff7ed", border: "2px solid #fed7aa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#f97316" }}>
                      {i + 1}
                    </div>
                    {i < selected.steps.length - 1 && (
                      <div style={{ width: "2px", flex: 1, background: "#f3f4f6", margin: "4px 0" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, background: "#fafafa", borderRadius: "12px", padding: "14px 16px", border: "1px solid #f3f4f6", marginBottom: i < selected.steps.length - 1 ? "0" : "0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "6px", background: "#f3f4f6", fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                          {step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}
                        </span>
                        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: "14px", color: "#111827" }}>{step.subject}</p>
                        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: 1.5 }}>
                          {step.body.slice(0, 120)}{step.body.length > 120 ? "…" : ""}
                        </p>
                      </div>
                      <button onClick={() => deleteStep(step.id)}
                        style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #fee2e2", background: "#fef2f2", color: "#dc2626", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add step form */}
            {showStepForm ? (
              <div style={{ background: "#f9fafb", borderRadius: "14px", padding: "20px", border: "1px dashed #d1d5db" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#111827" }}>Add Email Step</h3>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
                    Send after (days from subscribe)
                  </label>
                  <input type="number" value={stepForm.delayDays} onChange={(e) => setStepForm((f) => ({ ...f, delayDays: e.target.value }))}
                    min="0" placeholder="0 = immediately"
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", width: "160px" }}
                  />
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Subject line</label>
                  <input value={stepForm.subject} onChange={(e) => setStepForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="Welcome to the community!"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Email body</label>
                  <textarea value={stepForm.body} onChange={(e) => setStepForm((f) => ({ ...f, body: e.target.value }))}
                    rows={5} placeholder="Hi {{first_name}}, thanks for joining…"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={addStep} disabled={addingStep || !stepForm.subject || !stepForm.body}
                    style={{ padding: "9px 20px", borderRadius: "8px", background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff", fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer" }}>
                    {addingStep ? "Adding…" : "Add Step"}
                  </button>
                  <button onClick={() => { setShowStepForm(false); setStepForm({ delayDays: "0", subject: "", body: "" }); }}
                    style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowStepForm(true)}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px dashed #e5e7eb", background: "transparent", color: "#6b7280", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                + Add Email Step
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "16px", padding: "48px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📨</div>
            <p style={{ margin: 0, fontSize: "14px" }}>Select or create a sequence to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

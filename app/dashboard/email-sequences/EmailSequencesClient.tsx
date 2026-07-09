"use client";
import { useState } from "react";
import { Mail, Plus, X, Play, Pause, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-7">
          <div className="flex items-center gap-2.5 mb-1">
            <Mail className="w-5 h-5 text-orange-400" />
            <h1 className="text-2xl font-bold text-foreground">Email Sequences</h1>
          </div>
          <p className="text-sm text-muted-foreground">Build automated drip campaigns. Create a sequence, add steps with delays, enrol subscribers.</p>
        </div>

        <div className="grid grid-cols-[260px_1fr] gap-6 items-start">
          {/* Left panel — sequence list */}
          <div className="space-y-3">
            {/* Create new */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSequence()}
                placeholder="New sequence name…"
                className="text-sm"
              />
              <Button
                onClick={createSequence}
                disabled={creating || !newName.trim()}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-1.5 h-9 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />{creating ? "Creating…" : "New Sequence"}
              </Button>
            </div>

            {sequences.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No sequences yet</p>
            ) : (
              <div className="space-y-2">
                {sequences.map((seq) => (
                  <button
                    key={seq.id}
                    onClick={() => setSelected(seq)}
                    className={cn("w-full text-left px-4 py-3 rounded-xl border transition-all",
                      selected?.id === seq.id
                        ? "border-orange-500/50 bg-orange-500/8"
                        : "border-border bg-card hover:border-orange-500/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{seq.name}</p>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}</span>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border",
                        seq.active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-muted text-muted-foreground border-border")}>
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
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              {/* Sequence header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-base font-bold text-foreground">{selected.name}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(selected)}
                    className={cn("flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                      selected.active
                        ? "border-border text-muted-foreground hover:text-foreground"
                        : "border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20"
                    )}
                  >
                    {selected.active ? <><Pause className="w-3 h-3" />Pause</> : <><Play className="w-3 h-3" />Activate</>}
                  </button>
                  <button
                    onClick={() => deleteSequence(selected)}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Timeline */}
              {selected.steps.length === 0 && !showStepForm && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No steps yet. Add your first email below.
                </div>
              )}

              <div className="space-y-3">
                {selected.steps.map((step, i) => (
                  <div key={step.id} className="flex gap-4">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-400">
                        {i + 1}
                      </div>
                      {i < selected.steps.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border my-1" />
                      )}
                    </div>
                    {/* Step card */}
                    <div className="flex-1 bg-background border border-border rounded-xl p-4 mb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground mb-2">
                            {step.delayDays === 0 ? "Immediately" : `Day ${step.delayDays}`}
                          </span>
                          <p className="text-sm font-semibold text-foreground mb-1">{step.subject}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {step.body.slice(0, 120)}{step.body.length > 120 ? "…" : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteStep(step.id)}
                          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add step form */}
              {showStepForm ? (
                <div className="border border-dashed border-border rounded-xl p-5 space-y-4 bg-muted/30">
                  <h3 className="text-sm font-bold text-foreground">Add Email Step</h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Send after (days from subscribe)</Label>
                    <Input
                      type="number"
                      value={stepForm.delayDays}
                      onChange={(e) => setStepForm((f) => ({ ...f, delayDays: e.target.value }))}
                      min="0" placeholder="0 = immediately"
                      className="w-40 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Subject line</Label>
                    <Input
                      value={stepForm.subject}
                      onChange={(e) => setStepForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Welcome to the community!"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email body</Label>
                    <textarea
                      value={stepForm.body}
                      onChange={(e) => setStepForm((f) => ({ ...f, body: e.target.value }))}
                      rows={5}
                      placeholder="Hi {{first_name}}, thanks for joining…"
                      className="w-full rounded-lg border border-input bg-background text-sm px-3 py-2 placeholder:text-muted-foreground resize-vertical focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={addStep}
                      disabled={addingStep || !stepForm.subject || !stepForm.body}
                      className="bg-orange-500 hover:bg-orange-600 text-white h-9 text-xs font-semibold"
                    >
                      {addingStep ? "Adding…" : "Add Step"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowStepForm(false); setStepForm({ delayDays: "0", subject: "", body: "" }); }}
                      className="h-9 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowStepForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground hover:border-orange-500/40 hover:text-orange-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />Add Email Step
                </button>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-14 text-center">
              <Mail className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select or create a sequence to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

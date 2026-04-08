"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X, Bug, Lightbulb, Star, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = "bug" | "idea" | "praise" | "other";

const CATEGORIES: { value: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "bug", label: "Bug", icon: <Bug className="w-3.5 h-3.5" />, color: "border-red-400 text-red-500 bg-red-500/10" },
  { value: "idea", label: "Idea", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "border-yellow-400 text-yellow-500 bg-yellow-500/10" },
  { value: "praise", label: "Praise", icon: <Star className="w-3.5 h-3.5" />, color: "border-green-400 text-green-500 bg-green-500/10" },
  { value: "other", label: "Other", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "border-blue-400 text-blue-500 bg-blue-500/10" },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("idea");
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const pathname = usePathname();

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, rating: rating || null, message, page: pathname }),
    });
    setSubmitting(false);
    setDone(true);
    setTimeout(() => {
      setOpen(false);
      setDone(false);
      setMessage("");
      setRating(0);
      setCategory("idea");
    }, 2000);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="w-80 rounded-xl border border-border bg-card shadow-xl p-4 space-y-3"
          >
            {done ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <p className="font-medium">Thanks for your feedback!</p>
                <p className="text-xs text-muted-foreground">We read every submission.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Send Feedback</p>
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Category */}
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                        category === c.value ? c.color : "border-border text-muted-foreground hover:border-foreground/40"
                      )}
                    >
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>

                {/* Star rating */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setRating(s === rating ? 0 : s)}
                      className={cn("text-lg transition-colors", s <= rating ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400")}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-1 self-center">
                    {rating ? `${rating}/5` : "Optional"}
                  </span>
                </div>

                {/* Message */}
                <Textarea
                  placeholder="What's on your mind? Bug, idea, or just a thought…"
                  className="resize-none text-sm min-h-[80px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={submitting || !message.trim()}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Feedback
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 py-2.5 shadow-lg text-sm font-medium transition-colors"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </motion.button>
    </div>
  );
}

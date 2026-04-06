"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Upload, ArrowRight } from "lucide-react";

type CreateVideoModalProps = {
  open: boolean;
  onClose: () => void;
};

const OPTIONS = [
  {
    id: "existing",
    icon: Package,
    title: "Use Existing Product",
    description: "Pick from your products",
    href: "/dashboard/videos/select-product",
  },
  {
    id: "new",
    icon: Upload,
    title: "Upload / Paste Product",
    description: "For Canva, PDFs, links, etc.",
    href: "/dashboard/digital-products/create",
  },
];

export function CreateVideoModal({ open, onClose }: CreateVideoModalProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (href: string, id: string) => {
    setSelected(id);
    setTimeout(() => {
      onClose();
      router.push(href);
      setSelected(null);
    }, 150);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white dark:bg-[#111] rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-white/10 pointer-events-auto">

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Create a Video
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    How do you want to create your video?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Options */}
              <div className="px-6 pb-6 space-y-3">
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.href, opt.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all group ${
                      selected === opt.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                        : "border-gray-200 dark:border-white/10 hover:border-orange-400 dark:hover:border-orange-500/60 hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 flex items-center justify-center shrink-0 transition-colors">
                      <opt.icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {opt.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

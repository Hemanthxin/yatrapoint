"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Generic popup dialog — used for the Privacy Policy / Terms of Service
// previews on the login page (and reusable anywhere else a lightweight modal
// is needed) so the visitor doesn't have to leave the page to read them.
export function Modal({ open, onClose, title, children }: ModalProps) {
  // Rendered through a portal to document.body so `fixed inset-0` positions
  // against the real viewport — nesting inside any ancestor with a `transform`
  // (e.g. the `animate-fadeUp` entrance animation) otherwise turns that
  // ancestor into the fixed-position containing block and clips the modal.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Colours come from the theme variables (solid --app-bg, not the translucent
          --surface some themes use) so the panel, its header and its text always
          agree — the old bg-white header stayed white in dark mode while the
          title turned light. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        style={{ backgroundColor: "var(--app-bg, #fff)", color: "var(--text-soft, #475569)", border: "1px solid var(--border, #e2e8f0)" }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ backgroundColor: "var(--app-bg, #fff)", borderBottom: "1px solid var(--border, #f1f5f9)" }}
        >
          <h2 className="text-lg font-extrabold tracking-tight" style={{ color: "var(--text, #0f172a)" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70"
            style={{ color: "var(--muted, #94a3b8)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 px-5 py-5 text-sm leading-relaxed">{children}</div>
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { TOAST_EVENT, type ToastDetail } from "@/lib/toast";

interface Toast extends ToastDetail {
  id: number;
}

// Renders transient popups fired via showToast(). Mounted once in the app shell.
// Stacks toasts bottom-center (above the mobile dock) and auto-dismisses each.
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, ...detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex animate-pop items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 shadow-[0_18px_50px_-12px_rgba(2,6,23,0.35)] backdrop-blur"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            {t.emoji ? (
              <span className="text-base leading-none">{t.emoji}</span>
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

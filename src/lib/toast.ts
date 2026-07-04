"use client";

// A tiny app-wide toast bus. Any client component can fire a transient popup via
// showToast(); a single <ToastHost> mounted in the app shell renders them.
export const TOAST_EVENT = "yatra-toast";

export interface ToastDetail {
  message: string;
  emoji?: string;
}

export function showToast(message: string, emoji?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, emoji } })
  );
}

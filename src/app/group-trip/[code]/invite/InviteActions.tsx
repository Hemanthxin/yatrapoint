"use client";

import { useState } from "react";
import { Copy, Check, Share2, Mail, MessageCircle } from "lucide-react";
import { showToast } from "@/lib/toast";

// Every option here is a plain client-side link/API — no backend mail/SMS
// service exists in this app, so "inviting" means handing the traveller a
// link through whichever channel they already use, not Saafera sending
// anything on their behalf.
export function InviteActions({ joinCode, tripName }: { joinCode: string; tripName: string }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/join/${joinCode}` : `/join/${joinCode}`;
  const message = `Join my trip "${tripName}" on Saafera: ${url}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("Invite link copied", "🔗");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy — copy it manually", "⚠️");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: tripName, text: message, url });
      } catch {
        /* dismissed */
      }
      return;
    }
    copyLink();
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invite friends</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50"
        >
          <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50"
        >
          {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5 text-emerald-600" />}
          {copied ? "Copied" : "Copy Link"}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50"
        >
          <Share2 className="h-5 w-5 text-emerald-600" /> Share
        </button>
        <a
          href={`mailto:?subject=${encodeURIComponent(`Join my trip: ${tripName}`)}&body=${encodeURIComponent(message)}`}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50"
        >
          <Mail className="h-5 w-5 text-emerald-600" /> Email
        </a>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-xs font-mono text-slate-600">{url}</p>
        <button type="button" onClick={copyLink} className="shrink-0 text-xs font-bold text-emerald-700">
          Copy
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";

import type { Announcement } from "@/lib/db/schema";
import { addAnnouncement, deleteAnnouncement, toggleAnnouncement } from "@/lib/actions/announcements";

// Admin control for the moving headline ticker. Renders straight from the
// `initial` prop (refreshed by router.refresh after each change).
export function AnnouncementsManager({ initial }: { initial: Announcement[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    const msg = text.trim();
    if (msg.length < 3) return;
    setError(null);
    start(async () => {
      const res = await addAnnouncement(msg);
      if (!res.ok) {
        setError(res.error ?? "Could not add headline.");
        return;
      }
      setText("");
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteAnnouncement(id);
      router.refresh();
    });
  }

  function toggle(a: Announcement) {
    start(async () => {
      await toggleAnnouncement(a.id, !a.isActive);
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-extrabold tracking-tight text-slate-900">Headlines / News ticker</h2>
          <p className="text-xs text-slate-500">Type a message — it scrolls across the top of the app.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          maxLength={300}
          placeholder="e.g. Monsoon offers live — plan your Coorg trip now!"
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]"
        />
        <button
          onClick={add}
          disabled={pending || text.trim().length < 3}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}

      <ul className="mt-4 space-y-2">
        {initial.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">
            No headlines yet — add one above.
          </li>
        ) : (
          initial.map((a) => (
            <li
              key={a.id}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${
                a.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${a.isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{a.message}</span>
              <button
                onClick={() => toggle(a)}
                title={a.isActive ? "Hide from ticker" : "Show in ticker"}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {a.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => remove(a.id)}
                title="Delete"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

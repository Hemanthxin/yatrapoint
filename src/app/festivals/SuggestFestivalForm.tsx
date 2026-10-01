"use client";

import { useState, type FormEvent } from "react";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { suggestFestival } from "@/lib/actions/festival-suggestions";

// BUG-10: the way in for a locally-organised festival or event. Opens as a
// small panel under a button on the Festivals page rather than its own route,
// so suggesting something never takes the traveller off the list they're
// looking at. Submissions are reviewed by an admin before going live.
export function SuggestFestivalForm() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [hub, setHub] = useState("");
  const [dateISO, setDateISO] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [significance, setSignificance] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await suggestFestival({ name, hub, dateISO, dateLabel, significance });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't save that.");
      return;
    }
    setDone(true);
    setName("");
    setHub("");
    setDateISO("");
    setDateLabel("");
    setSignificance("");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setDone(false);
        }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:scale-[1.02] active:scale-95"
      >
        <CalendarPlus className="h-4 w-4" /> Suggest a festival
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-slate-900">
            Suggest a festival or event
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Know a local jatre, temple festival or town fair that isn’t listed? Tell us and we’ll
            add it after a quick check.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {done ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">Thanks — sent for review.</p>
            <p className="mt-0.5 text-xs">
              It appears on this page once an admin approves it.
            </p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="mt-2 text-xs font-bold underline"
            >
              Suggest another
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Festival name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={140}
              placeholder="e.g. Kadalekai Parishe"
              className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
            />
          </Field>
          <Field label="Town or city">
            <input
              value={hub}
              onChange={(e) => setHub(e.target.value)}
              maxLength={160}
              placeholder="e.g. Basavanagudi, Bengaluru"
              className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
            />
          </Field>
          <Field label="Date" hint="Leave blank if it moves each year">
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
            />
          </Field>
          <Field label="…or when it happens" hint="Used when there's no fixed date">
            <input
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              maxLength={80}
              placeholder="e.g. Second week of November"
              className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="What happens there?">
              <textarea
                value={significance}
                onChange={(e) => setSignificance(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="A groundnut fair held around the Bull Temple every November…"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
              />
            </Field>
          </div>

          {error && (
            <p className="sm:col-span-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {saving ? "Sending…" : "Send for review"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Palette,
  UserRound,
  Check,
  Save,
  LogOut,
  ArrowRight,
  AtSign,
  Bookmark,
  ShieldCheck,
} from "lucide-react";

import { THEMES, type ThemeId } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { updateProfile } from "@/lib/actions/profile";
import { signOutAction } from "@/lib/actions/auth";

interface Initial {
  name: string;
  username: string;
  bio: string;
  email: string;
  phone: string;
}

// Little colour swatch preview per theme.
const THEME_SWATCH: Record<ThemeId, string[]> = {
  light: ["#ffffff", "#eef1f5", "#ef4f5f"],
  dark: ["#0b0f14", "#1c2431", "#ff5c6a"],
  vibrant: ["#2a1148", "#b3277a", "#ff5c6a"],
};

export function SettingsClient({ initial }: { initial: Initial }) {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await updateProfile({ name, username, bio, email: initial.email });
      if (!res.ok) {
        setErr(res.error ?? "Could not save changes.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="animate-fadeUp mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Palette className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Settings
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Personalise the app and your profile.
          </p>
        </div>
      </header>

      {/* Appearance / theme */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          <Palette className="h-4 w-4 text-emerald-600" /> Appearance
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pick a theme — it applies instantly on mobile devices. (Desktop keeps the classic look.)
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={active}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-transparent ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "border-slate-200 hover:border-emerald-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{t.emoji}</span>
                  {active && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-extrabold text-slate-900">{t.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{t.desc}</p>
                <div className="mt-3 flex gap-1.5">
                  {THEME_SWATCH[t.id].map((c, i) => (
                    <span
                      key={i}
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Profile */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          <UserRound className="h-4 w-4 text-emerald-600" /> Profile
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Full name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_var(--ring)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Username
            </span>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourhandle"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_var(--ring)]"
              />
            </div>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Tell fellow travellers about yourself…"
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_var(--ring)]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Phone (verified)
            </span>
            <input
              value={initial.phone || "—"}
              disabled
              className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email
            </span>
            <input
              value={initial.email || "—"}
              disabled
              className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
            />
          </label>
        </div>

        {err && <p className="mt-3 text-sm font-medium text-rose-600">{err}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {pending ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            Full profile & photo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Account
        </h2>
        <div className="mt-3 divide-y divide-slate-100">
          <Link
            href="/profile"
            className="flex items-center justify-between py-3 text-sm font-semibold text-slate-800"
          >
            <span className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-slate-400" /> Your travel places
            </span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </Link>
          <form action={signOutAction} className="pt-3">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl py-2 text-sm font-semibold text-rose-600 transition hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

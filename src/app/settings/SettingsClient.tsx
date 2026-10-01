"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Cog,
  UserRound,
  Check,
  Save,
  LogOut,
  ArrowRight,
  AtSign,
  Bookmark,
  ShieldCheck,
  Info,
  HelpCircle,
  Lock,
  FileText,
  AlertTriangle,
  Trash2,
  History,
  type LucideIcon,
} from "lucide-react";

import { updateProfile } from "@/lib/actions/profile";
import { signOutAction, deleteAccountAction } from "@/lib/actions/auth";
import { Reveal } from "@/components/app/Reveal";

interface Initial {
  name: string;
  username: string;
  bio: string;
  email: string;
  phone: string;
}

export function SettingsClient({ initial }: { initial: Initial }) {
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deletePending, startDelete] = useTransition();
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const confirmPhrase = initial.username || "delete my account";

  function confirmDelete() {
    setDeleteErr(null);
    startDelete(async () => {
      const res = await deleteAccountAction();
      if (res && !res.ok) {
        setDeleteErr(res.error ?? "Could not delete your account.");
      }
      // On success, deleteAccountAction redirects away — nothing left to do here.
    });
  }

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
    <Reveal className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
          <Cog className="h-6 w-6" />
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

      {/* About & Support */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
          <Info className="h-4 w-4 text-emerald-600" /> About &amp; Support
        </h2>
        <div className="mt-3 divide-y divide-slate-100">
          <SettingLink href="/about" icon={Info} label="About Saafera" desc="What the app does & how it works" />
          <SettingLink href="/faq" icon={HelpCircle} label="FAQ / Q&A" desc="Answers to common questions" />
          <SettingLink href="/privacy" icon={Lock} label="Privacy Policy" desc="How we handle your data" />
          <SettingLink href="/terms" icon={FileText} label="Terms of Service" desc="The rules for using Saafera" />
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
          <Link
            href="/trip-history"
            className="flex items-center justify-between py-3 text-sm font-semibold text-slate-800"
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" /> Trip history
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

      {/* Danger Zone — GitHub-style account deletion, gated behind typing a
          confirmation phrase so it can't be triggered by a stray click. */}
      <section className="rounded-3xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-rose-600">
          <AlertTriangle className="h-4 w-4" /> Danger Zone
        </h2>

        {!deleteOpen ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Permanently delete your account and all associated data — trips, favourites,
              cart, and community posts.
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3 rounded-2xl border border-rose-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">This cannot be undone.</p>
            <p className="text-sm text-slate-600">
              This will permanently delete your profile, saved favourites, trip plans, cart,
              and any community posts or comments you've made.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Type <span className="font-mono text-rose-600">{confirmPhrase}</span> to confirm
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:shadow-[0_0_0_4px_rgba(244,63,94,0.15)]"
              />
            </label>
            {deleteErr && <p className="text-sm font-medium text-rose-600">{deleteErr}</p>}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={confirmText !== confirmPhrase || deletePending}
                onClick={confirmDelete}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletePending ? "Deleting…" : "Delete my account permanently"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setConfirmText("");
                  setDeleteErr(null);
                }}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </Reveal>
  );
}

function SettingLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 transition hover:opacity-80">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}

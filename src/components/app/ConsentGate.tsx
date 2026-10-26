"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { getMyConsentStatus, acceptRequiredConsents } from "@/lib/actions/consent";
import { Modal } from "@/components/app/Modal";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";
import { TermsOfServiceContent } from "@/components/legal/TermsOfServiceContent";

// Blocks the app until a signed-in person has agreed to the current Privacy
// Policy and Terms. It catches everyone who skipped the sign-up checkboxes:
// people who signed in with Google, accounts created before consent was
// recorded, and everyone again whenever a policy version is bumped.
export function ConsentGate() {
  const [needs, setNeeds] = useState(false);
  const [privacyOk, setPrivacyOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"privacy" | "terms" | null>(null);

  useEffect(() => {
    let alive = true;
    getMyConsentStatus()
      .then((s) => alive && setNeeds(s.signedIn && s.needsConsent))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!needs) return null;

  async function accept() {
    setError(null);
    setSaving(true);
    const res = await acceptRequiredConsents({ privacy: privacyOk, terms: termsOk });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setNeeds(false);
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="consent-title" className="text-xl font-extrabold tracking-tight text-slate-900">
          Before you continue
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Please review how Saafera uses your details and agree to continue. You can withdraw your consent any time in Settings.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={privacyOk} onChange={(e) => setPrivacyOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span>
              I have read the{" "}
              <button type="button" onClick={() => setView("privacy")} className="font-semibold text-emerald-700 underline underline-offset-2">
                Privacy Policy
              </button>{" "}
              and agree to Saafera using my details as described in it.
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            <span>
              I agree to the{" "}
              <button type="button" onClick={() => setView("terms")} className="font-semibold text-emerald-700 underline underline-offset-2">
                Terms of Service
              </button>
              .
            </span>
          </label>
        </div>

        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={accept}
            disabled={saving || !privacyOk || !termsOk}
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "I agree"}
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>

      <Modal open={view === "privacy"} onClose={() => setView(null)} title="Privacy Policy">
        <PrivacyPolicyContent />
      </Modal>
      <Modal open={view === "terms"} onClose={() => setView(null)} title="Terms of Service">
        <TermsOfServiceContent />
      </Modal>
    </div>
  );
}

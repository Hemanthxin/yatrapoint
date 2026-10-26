"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Lock, MapPin } from "lucide-react";
import { getMyConsentStatus, setLocationConsent, type MyConsent } from "@/lib/actions/consent";
import { LOCATION_CONSENT_EVENT } from "./LocationConsentGuard";

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

// Settings → Privacy & consent: what the person agreed to (and when), plus the
// ability to withdraw location consent. Withdrawing the Privacy Policy itself
// means we can no longer provide the service, so that path leads to account deletion.
export function PrivacyControls() {
  const [status, setStatus] = useState<MyConsent | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getMyConsentStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!status?.signedIn) return null;

  function toggleLocation() {
    if (!status) return;
    const next = !status.locationAllowed;
    setErr(null);
    start(async () => {
      const res = await setLocationConsent(next);
      if (!res.ok) return setErr(res.error);
      setStatus({ ...status, locationAllowed: next });
      window.dispatchEvent(new CustomEvent(LOCATION_CONSENT_EVENT, { detail: { allowed: next } }));
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
        <Lock className="h-4 w-4 text-emerald-600" /> Privacy &amp; consent
      </h2>

      <div className="mt-3 space-y-3 text-sm text-slate-600">
        <p>
          {status.privacy ? (
            <>
              You agreed to the <Link href="/privacy" className="font-semibold text-emerald-700 underline underline-offset-2">Privacy Policy</Link>
              {" "}(version {status.privacy.version}) on {fmt(status.privacy.at)}
              {status.terms ? <> and the <Link href="/terms" className="font-semibold text-emerald-700 underline underline-offset-2">Terms of Service</Link> on {fmt(status.terms.at)}</> : null}.
            </>
          ) : (
            "We have no record of your agreement yet. You'll be asked to review it."
          )}
        </p>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-slate-800">Use my location</p>
              <p className="text-xs text-slate-500">
                Shows nearby places, distances and local weather. Turning it off stops Saafera asking your device for your location.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={status.locationAllowed}
            aria-label="Use my location"
            onClick={toggleLocation}
            disabled={pending}
            className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${status.locationAllowed ? "bg-emerald-600" : "bg-slate-300"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${status.locationAllowed ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
        </div>
        {err && <p className="text-xs font-medium text-rose-600">{err}</p>}

        <p className="text-xs text-slate-500">
          To withdraw your agreement to the Privacy Policy altogether, delete your account — Saafera can&apos;t work without it.{" "}
          <a href="#danger-zone" className="font-semibold text-rose-600 underline underline-offset-2">
            Go to Delete account
          </a>
          .
        </p>
      </div>
    </section>
  );
}

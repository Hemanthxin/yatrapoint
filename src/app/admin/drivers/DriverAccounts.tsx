"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Lock } from "lucide-react";
import { resetCabDriverPassword } from "@/lib/actions/admin-cabs";

interface Driver {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  hasPassword: boolean;
  locked: boolean;
  vehicle: string | null;
  vehicleStatus: string | null;
}

export function DriverAccounts({ drivers }: { drivers: Driver[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<{ id: string; name: string; phone: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function reset(d: Driver) {
    if (!confirm(`Reset the password for ${d.name} (${d.phone})? They will be signed out everywhere and must use the new temporary password.`)) return;
    setError("");
    setCopied(false);
    start(async () => {
      const res = await resetCabDriverPassword(d.id);
      if (res.ok) setIssued({ id: d.id, name: d.name, phone: d.phone, password: res.password });
      else setError(res.error);
      router.refresh();
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {}
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-extrabold text-slate-900">Driver accounts</h2>
      <p className="mt-1 text-sm text-slate-500">If a driver forgets their password, reset it here and pass the temporary password to them. They can change it from their Profile in the Captain app.</p>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">{error}</p>}

      {issued && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-extrabold text-amber-900">
            New password for {issued.name} ({issued.phone})
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-white px-3 py-2 text-lg font-extrabold tracking-wider text-slate-900">{issued.password}</code>
            <button onClick={() => copy(`Saafera Captain\nMobile: ${issued.phone}\nTemporary password: ${issued.password}`)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white">
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800">Shown only now — it can&apos;t be looked up again. Give it to the driver privately.</p>
          <button onClick={() => setIssued(null)} className="mt-2 text-xs font-bold text-amber-900 underline">
            Hide
          </button>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {drivers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No drivers have signed up yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {drivers.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900">{d.name}</span>
                    {d.locked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-extrabold text-red-700">
                        <Lock className="h-3 w-3" /> locked out
                      </span>
                    )}
                    {!d.hasPassword && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">no password set</span>}
                  </div>
                  <div className="text-sm text-slate-500">
                    {d.phone} · {d.vehicle ? `${d.vehicle} (${d.vehicleStatus})` : "no vehicle yet"}
                  </div>
                </div>
                <button disabled={pending} onClick={() => reset(d)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  <KeyRound className="h-4 w-4" /> Reset password
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

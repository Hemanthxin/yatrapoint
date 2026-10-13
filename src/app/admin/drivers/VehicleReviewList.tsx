"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CarFront } from "lucide-react";
import { reviewCabVehicle } from "@/lib/actions/admin-cabs";

interface Row {
  id: string;
  type: string;
  makeModel: string;
  colour: string | null;
  plate: string;
  year: number | null;
  seats: number;
  ac: boolean;
  city: string;
  ratePerKm: number;
  baseFare: number;
  rcNo: string | null;
  photoUrl: string | null;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  available: boolean;
  driverName: string;
  driverPhone: string;
  licenceNo: string | null;
}

const TONE = { pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-700" };

export function VehicleReviewList({ vehicles }: { vehicles: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  function act(id: string, approve: boolean) {
    setError("");
    start(async () => {
      const res = await reviewCabVehicle(id, approve, reason[id]);
      if (!res.ok) setError(res.error ?? "Could not save.");
      router.refresh();
    });
  }

  if (vehicles.length === 0) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No drivers have registered a vehicle yet.</div>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">{error}</p>}
      {vehicles.map((v) => (
        <article key={v.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
          <div className="grid h-32 w-full shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 sm:w-44">
            {v.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.photoUrl} alt={v.makeModel} className="h-full w-full object-cover" />
            ) : (
              <CarFront className="h-10 w-10 text-slate-300" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">{v.makeModel}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold capitalize ${TONE[v.status]}`}>{v.status}</span>
              {v.status === "approved" && v.available && <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-extrabold text-sky-700">taking bookings</span>}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              <b className="tracking-wider">{v.plate}</b> · <span className="capitalize">{v.type}</span> · {v.seats} seats{v.ac ? " · AC" : ""}
              {v.colour ? ` · ${v.colour}` : ""}
              {v.year ? ` · ${v.year}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {v.city} · ₹{v.ratePerKm}/km{v.baseFare ? ` + ₹${v.baseFare} base` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Driver <b>{v.driverName}</b> · {v.driverPhone}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Licence: {v.licenceNo || "—"} · RC: {v.rcNo || "—"}
            </p>
            {v.status === "rejected" && v.rejectReason && <p className="mt-2 text-sm font-semibold text-red-600">Rejected: {v.rejectReason}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {v.status !== "approved" && (
                <button disabled={pending} onClick={() => act(v.id, true)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Approve
                </button>
              )}
              {v.status !== "rejected" && (
                <>
                  <input
                    value={reason[v.id] ?? ""}
                    onChange={(e) => setReason({ ...reason, [v.id]: e.target.value })}
                    placeholder="Reason (shown to the driver)"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 sm:max-w-xs"
                  />
                  <button disabled={pending} onClick={() => act(v.id, false)} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50">
                    {v.status === "approved" ? "Revoke" : "Reject"}
                  </button>
                </>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

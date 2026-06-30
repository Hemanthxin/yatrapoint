"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { INDIA_STATES } from "@/lib/india-states";
import {
  listDistricts,
  listTaluks,
  listAreaPlaces,
  type AreaPlace,
} from "@/lib/actions/areas";

export type AreaScope = "state" | "districts" | "taluks";

export interface AreaSelection {
  state: string;
  scope: AreaScope;
  districts: string[];
  // The district whose taluks are being chosen (taluks scope only).
  talukDistrict: string;
  taluks: string[];
  placeIds: string[];
}

export const EMPTY_AREA: AreaSelection = {
  state: "",
  scope: "state",
  districts: [],
  talukDistrict: "",
  taluks: [],
  placeIds: [],
};

interface Props {
  value: AreaSelection;
  onChange: (next: AreaSelection) => void;
}

export function AreaPicker({ value, onChange }: Props) {
  const [districts, setDistricts] = useState<string[]>([]);
  const [taluks, setTaluks] = useState<string[]>([]);
  const [places, setPlaces] = useState<AreaPlace[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingTaluks, setLoadingTaluks] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");

  // Track the latest request so a slow earlier fetch can't overwrite newer data.
  const districtReq = useRef(0);
  const talukReq = useRef(0);

  const set = (patch: Partial<AreaSelection>) => onChange({ ...value, ...patch });

  // Load districts + catalogue places whenever the state changes.
  useEffect(() => {
    if (!value.state) {
      setDistricts([]);
      setPlaces([]);
      return;
    }
    const id = ++districtReq.current;
    setLoadingDistricts(true);
    listDistricts(value.state)
      .then((d) => {
        if (districtReq.current === id) setDistricts(d);
      })
      .finally(() => {
        if (districtReq.current === id) setLoadingDistricts(false);
      });
    listAreaPlaces(value.state, []).then((p) => {
      if (districtReq.current === id) setPlaces(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.state]);

  // Load taluks when a district is chosen in "taluks" scope.
  useEffect(() => {
    if (value.scope !== "taluks" || !value.state || !value.talukDistrict) {
      setTaluks([]);
      return;
    }
    const id = ++talukReq.current;
    setLoadingTaluks(true);
    listTaluks(value.state, value.talukDistrict)
      .then((t) => {
        if (talukReq.current === id) setTaluks(t);
      })
      .finally(() => {
        if (talukReq.current === id) setLoadingTaluks(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.scope, value.state, value.talukDistrict]);

  function pickState(s: string) {
    onChange({ ...EMPTY_AREA, state: s, scope: value.scope });
  }

  function pickScope(scope: AreaScope) {
    set({ scope, districts: [], talukDistrict: "", taluks: [], placeIds: value.placeIds });
  }

  function toggleDistrict(d: string) {
    const has = value.districts.includes(d);
    const next = has ? value.districts.filter((x) => x !== d) : [...value.districts, d];
    set({ districts: next });
    // Narrow the catalogue place list to the chosen districts.
    listAreaPlaces(value.state, next).then(setPlaces);
  }

  function toggleTaluk(t: string) {
    const has = value.taluks.includes(t);
    const next = has ? value.taluks.filter((x) => x !== t) : [...value.taluks, t];
    set({ taluks: next });
  }

  function togglePlace(id: string) {
    const has = value.placeIds.includes(id);
    set({
      placeIds: has ? value.placeIds.filter((x) => x !== id) : [...value.placeIds, id],
    });
  }

  const filteredPlaces = places.filter((p) =>
    placeQuery.trim()
      ? p.name.toLowerCase().includes(placeQuery.trim().toLowerCase())
      : true
  );

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      {/* Step 1 — State */}
      <div>
        <Label step="1" title="Pick a state" hint="Required — choose where in India you want to travel." />
        <select
          value={value.state}
          onChange={(e) => pickState(e.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        >
          <option value="">Select a state…</option>
          {INDIA_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {value.state && (
        <>
          {/* Step 2 — how much to cover */}
          <div>
            <Label
              step="2"
              title="How much do you want to cover?"
              hint="Plan the whole state, or narrow down to specific districts or taluks."
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <ScopeCard
                active={value.scope === "state"}
                onClick={() => pickScope("state")}
                title="Whole state"
                desc={`Explore across ${value.state}`}
              />
              <ScopeCard
                active={value.scope === "districts"}
                onClick={() => pickScope("districts")}
                title="District(s)"
                desc="One or more districts"
              />
              <ScopeCard
                active={value.scope === "taluks"}
                onClick={() => pickScope("taluks")}
                title="Taluk(s)"
                desc="Taluks inside a district"
              />
            </div>
          </div>

          {/* Step 2a — choose districts */}
          {value.scope === "districts" && (
            <div>
              <Label
                title="Select district(s)"
                hint="Tick one for a single district, or several to combine them into one trip."
              />
              {loadingDistricts ? (
                <LoadingRow text="Loading districts from the map…" />
              ) : districts.length === 0 ? (
                <EmptyRow text="No districts found for this state right now — try the whole state instead." />
              ) : (
                <CheckGrid
                  items={districts}
                  selected={value.districts}
                  onToggle={toggleDistrict}
                />
              )}
            </div>
          )}

          {/* Step 2b — choose a district, then taluks */}
          {value.scope === "taluks" && (
            <div className="space-y-3">
              <div>
                <Label
                  title="Which district?"
                  hint="Pick the district first, then choose taluks inside it."
                />
                {loadingDistricts ? (
                  <LoadingRow text="Loading districts…" />
                ) : (
                  <select
                    value={value.talukDistrict}
                    onChange={(e) =>
                      set({ talukDistrict: e.target.value, taluks: [], districts: e.target.value ? [e.target.value] : [] })
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  >
                    <option value="">Select a district…</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
              </div>

              {value.talukDistrict && (
                <div>
                  <Label
                    title="Select taluk(s)"
                    hint="Tick one or more taluks to focus the plan on those areas."
                  />
                  {loadingTaluks ? (
                    <LoadingRow text="Loading taluks from the map…" />
                  ) : taluks.length === 0 ? (
                    <EmptyRow text="No taluks mapped here — the district plan will be used instead." />
                  ) : (
                    <CheckGrid items={taluks} selected={value.taluks} onToggle={toggleTaluk} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — optional specific places */}
          <div>
            <Label
              step="3"
              title="Add specific places (optional)"
              hint="Hand-pick famous spots from our catalogue — they'll always be included in your plan."
            />
            {places.length === 0 ? (
              <EmptyRow text="No catalogue places listed for this area yet — your plan will be built from the place types you choose below." />
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    placeholder="Search places by name…"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                  />
                </div>
                <div className="max-h-52 space-y-1 overflow-auto rounded-xl border border-slate-100 p-1">
                  {filteredPlaces.map((p) => {
                    const on = value.placeIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlace(p.id)}
                        className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                          on ? "bg-emerald-50 text-emerald-900" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                            on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"
                          }`}
                        >
                          {on && "✓"}
                        </span>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate font-medium">{p.name}</span>
                        {p.district && (
                          <span className="ml-auto shrink-0 text-xs text-slate-400">{p.district}</span>
                        )}
                      </button>
                    );
                  })}
                  {filteredPlaces.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-slate-400">No matching places.</p>
                  )}
                </div>
                {value.placeIds.length > 0 && (
                  <p className="mt-1.5 text-xs font-medium text-emerald-700">
                    {value.placeIds.length} place{value.placeIds.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Label({ step, title, hint }: { step?: string; title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {step && (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
            {step}
          </span>
        )}
        {title}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ScopeCard({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[60px] rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${
        active
          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
          : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
      }`}
    >
      <p className={`text-sm font-bold ${active ? "text-emerald-800" : "text-slate-800"}`}>{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </button>
  );
}

function CheckGrid({
  items,
  selected,
  onToggle,
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = selected.includes(it);
        return (
          <button
            key={it}
            type="button"
            onClick={() => onToggle(it)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
              on
                ? "border-transparent bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
            }`}
          >
            {on && <span>✓</span>}
            {it}
          </button>
        );
      })}
    </div>
  );
}

function LoadingRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
      {text}
    </div>
  );
}

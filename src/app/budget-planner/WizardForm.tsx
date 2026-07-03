"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  User,
  Heart,
  Users,
  UsersRound,
  Bus,
  Car,
  TrainFront,
  Bike,
  CheckCircle2,
  CalendarDays,
  MapPinned,
  ArrowRight,
  LocateFixed,
  Map as MapIcon,
  Loader2,
  Wallet,
} from "lucide-react";

import type { VehicleKind } from "@/lib/budget";
import { PLACE_GROUPS, TRIP_GROUPS } from "@/lib/catalog/place-groups";
import { geocodeArea } from "@/lib/actions/areas";
import { AreaPicker, EMPTY_AREA, type AreaSelection } from "./AreaPicker";
import { LivePlan, type LivePlanProps } from "./LivePlan";

const STEPS = ["Trip Details", "Preferences", "Travel Style", "Generate Plan"];
const DAY_OPTIONS = ["1 Day", "2 Days", "3 Days", "4 Days", "5+ Days"];
const TRAVELLER_OPTIONS = ["1", "2", "3", "4", "5+"];
const PLACES_OPTIONS = ["3", "4", "5", "6", "8", "10"];
const KM_OPTIONS = ["10", "25", "50", "100", "200"];
const SESSION_KEY = "yatra-point/budget-wizard";

// Budget slider uses a non-linear scale so the evenly-spaced ₹1K/5K/10K/20K/50K
// labels line up with the thumb (more precision at lower budgets).
const BUDGET_STOPS = [1000, 5000, 10000, 20000, 50000];

function budgetToSlider(b: number): number {
  if (b <= BUDGET_STOPS[0]) return 0;
  const last = BUDGET_STOPS.length - 1;
  for (let i = 0; i < last; i++) {
    const lo = BUDGET_STOPS[i];
    const hi = BUDGET_STOPS[i + 1];
    if (b <= hi) return ((i + (b - lo) / (hi - lo)) / last) * 100;
  }
  return 100;
}

function sliderToBudget(p: number): number {
  const last = BUDGET_STOPS.length - 1;
  const segF = (p / 100) * last;
  const i = Math.min(last - 1, Math.floor(segF));
  const frac = segF - i;
  const lo = BUDGET_STOPS[i];
  const hi = BUDGET_STOPS[i + 1];
  return Math.round((lo + frac * (hi - lo)) / 100) * 100;
}

const TRIP_TYPES = [
  { key: "Solo", icon: User },
  { key: "Couple", icon: Heart },
  { key: "Family", icon: Users },
  { key: "Friends", icon: UsersRound },
];

const TRANSPORT = [
  { key: "Any", icon: null },
  { key: "Bus", icon: Bus },
  { key: "Car", icon: Car },
  { key: "Train", icon: TrainFront },
  { key: "Bike", icon: Bike },
];

// Transport chip → travel mode sent to the planner (drives cost + map style).
const MODE_BY_TRANSPORT: Record<string, "any" | "car" | "bike" | "bus" | "train"> = {
  Any: "any",
  Bus: "bus",
  Car: "car",
  Train: "train",
  Bike: "bike",
};

const FOOD = ["Any", "Veg", "Non-Veg", "Jain", "Eggetarian"];

// Preferred transport → vehicle profile used for fuel-cost estimates.
const TRANSPORT_VEHICLE: Record<string, VehicleKind> = {
  Any: "small_car",
  Bus: "suv",
  Car: "small_car",
  Train: "small_car",
  Bike: "bike",
};

interface WizardFormProps {
  initial: { budget?: number; days?: number; travellers?: number };
}

// Pick the area to geocode: the narrowest unambiguous level. One taluk → that
// taluk; one district (no taluks) → that district; anything broader → the state
// centre (its big radius still covers the chosen districts).
function geocodeTarget(a: AreaSelection): { state: string; district?: string; taluk?: string } {
  if (a.scope === "taluks" && a.talukDistrict) {
    if (a.taluks.length === 1) return { state: a.state, district: a.talukDistrict, taluk: a.taluks[0] };
    return { state: a.state, district: a.talukDistrict };
  }
  if (a.scope === "districts" && a.districts.length === 1) {
    return { state: a.state, district: a.districts[0] };
  }
  return { state: a.state };
}

function areaLabel(a: AreaSelection): string {
  if (a.scope === "taluks" && a.taluks.length > 0) {
    return `${a.taluks.join(", ")} (${a.talukDistrict}, ${a.state})`;
  }
  if (a.scope === "districts" && a.districts.length > 0) {
    return `${a.districts.join(", ")}, ${a.state}`;
  }
  return a.state;
}

export function WizardForm({ initial }: WizardFormProps) {
  const [budget, setBudget] = useState(initial.budget ?? 5000);
  const [days, setDays] = useState(initial.days ? `${initial.days} Days` : "2 Days");
  const [travellers, setTravellers] = useState(initial.travellers?.toString() ?? "2");
  const [tripType, setTripType] = useState("Family");
  const [transport, setTransport] = useState("Any");
  const [food, setFood] = useState("Any");
  const [places, setPlaces] = useState("5");
  const [km, setKm] = useState("25");
  // Categories to explore — preset from the trip type, fully editable.
  const [groups, setGroups] = useState<Set<string>>(new Set(TRIP_GROUPS.Family));
  // Where to plan: "around" = live GPS + radius; "area" = a chosen state /
  // district / taluk anywhere in India.
  const [planMode, setPlanMode] = useState<"around" | "area">("around");
  const [area, setArea] = useState<AreaSelection>(EMPTY_AREA);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // The plan only regenerates when the user submits — we snapshot the inputs
  // here and bump `planKey` so <LivePlan> remounts and re-runs with them.
  const [snapshot, setSnapshot] = useState<LivePlanProps | null>(null);
  const [planKey, setPlanKey] = useState(0);

  const daysNum = days === "5+ Days" ? 5 : parseInt(days, 10) || 2;
  const travellersNum = travellers === "5+" ? 5 : parseInt(travellers, 10) || 2;

  // Restore the wizard + generated plan after returning to this page (e.g. after
  // opening a place's details and pressing Back).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        fields?: Record<string, unknown>;
        snapshot?: LivePlanProps;
      };
      const f = saved.fields ?? {};
      if (typeof f.budget === "number") setBudget(f.budget);
      if (typeof f.days === "string") setDays(f.days);
      if (typeof f.travellers === "string") setTravellers(f.travellers);
      if (typeof f.tripType === "string") setTripType(f.tripType);
      if (typeof f.transport === "string") setTransport(f.transport);
      if (typeof f.food === "string") setFood(f.food);
      if (typeof f.places === "string") setPlaces(f.places);
      if (typeof f.km === "string") setKm(f.km);
      if (Array.isArray(f.groups)) setGroups(new Set(f.groups as string[]));
      if (f.planMode === "around" || f.planMode === "area") setPlanMode(f.planMode);
      if (f.area && typeof f.area === "object") setArea(f.area as AreaSelection);
      if (saved.snapshot) setSnapshot(saved.snapshot);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picking a trip type resets the category chips to that type's preset.
  function pickTripType(key: string) {
    setTripType(key);
    setGroups(new Set(TRIP_GROUPS[key] ?? TRIP_GROUPS.Family));
  }

  // Choosing travellers; 1 traveller auto-selects the Solo trip type.
  function pickTravellers(t: string) {
    setTravellers(t);
    if (t === "1") pickTripType("Solo");
  }

  function toggleGroup(slug: string) {
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAreaError(null);

    const snap: LivePlanProps = {
      budget,
      people: travellersNum,
      hours: Math.min(120, Math.max(6, daysNum * 9)),
      vehicle: TRANSPORT_VEHICLE[transport] ?? "small_car",
      mode: MODE_BY_TRANSPORT[transport] ?? "any",
      groups: [...groups],
      includeFood: true,
      // At least ~2 stops per day so a multi-day trip has enough places to
      // genuinely split across each day (honouring the chosen places count).
      maxStops: Math.min(15, Math.max(parseInt(places, 10) || 5, daysNum * 2)),
      days: daysNum,
      radiusKm: Math.max(1, parseInt(km, 10) || 25),
    };

    // Area mode — geocode the chosen state / district / taluk to a centre and
    // plan there, plus carry any hand-picked catalogue places.
    if (planMode === "area") {
      if (!area.state) {
        setAreaError("Choose a state to plan in.");
        return;
      }
      if (groups.size === 0 && area.placeIds.length === 0) {
        setAreaError("Pick at least one place type below, or add specific places.");
        return;
      }
      setGeocoding(true);
      const target = geocodeTarget(area);
      const centre = await geocodeArea(target);
      setGeocoding(false);
      if (!centre) {
        setAreaError("Couldn't locate that area — try a different district or taluk.");
        return;
      }
      snap.originOverride = {
        lat: centre.lat,
        lng: centre.lng,
        label: areaLabel(area),
      };
      snap.radiusKm = centre.radiusKm;
      snap.placeIds = area.placeIds;
      // Constrain the curated catalogue to exactly the chosen district(s)/taluk
      // so places from other districts don't leak into the plan.
      snap.areaDistricts =
        area.scope === "taluks" && area.talukDistrict
          ? [area.talukDistrict]
          : area.scope === "districts"
          ? area.districts
          : [];
    }

    setSnapshot(snap);
    setPlanKey((k) => k + 1);
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          fields: { budget, days, travellers, tripType, transport, food, places, km, groups: [...groups], planMode, area },
          snapshot: snap,
        })
      );
    } catch {
      // ignore
    }
    requestAnimationFrame(() => {
      document.getElementById("live-plan")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <>
    <form onSubmit={onSubmit} className="animate-fadeUp space-y-6">
      {/* Hero — bold Play-Store gradient card */}
      <div className="relative overflow-hidden rounded-3xl bg-emerald-600 p-6 shadow-xl shadow-emerald-500/30 md:p-8">
        {/* Faint photo/glow overlay for depth */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_90%_-10%,rgba(255,255,255,0.35),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_80%_at_0%_110%,rgba(4,120,87,0.5),transparent_60%)] mix-blend-screen" />
        <span aria-hidden className="sheen-overlay animate-sheen" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-white backdrop-blur">
            <Wallet className="h-3.5 w-3.5" /> Smart planner
          </span>
          <h1 className="mt-3 text-3xl font-extrabold leading-[1.05] tracking-tight text-white md:text-4xl">
            Budget Planner
          </h1>
          <p className="mt-2 max-w-md text-sm font-medium text-white/85 md:text-base">
            Plan your perfect trip within your budget. Tell us your preferences and we&apos;ll
            handle the rest.
          </p>
        </div>
      </div>

      {/* Stepper — horizontal rail on mobile, no overflow */}
      <div className="-mx-4 flex items-center gap-x-2 gap-y-3 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        {STEPS.map((s, i) => {
          const active = i === 0;
          return (
            <div key={s} className="flex shrink-0 items-center gap-2">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
                  active
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={`whitespace-nowrap text-sm font-bold ${active ? "text-slate-900" : "text-slate-400"}`}>
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <span className="mx-1 hidden h-px w-8 bg-slate-200 sm:inline-block" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Where to go — around me vs a chosen area in India */}
          <div className="card-hover rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <CardHeader
              title="Where do you want to go?"
              tone="emerald"
              icon={<MapPinned className="h-[18px] w-[18px]" />}
            />
            <p className="-mt-2 mb-3 ml-[3.25rem] text-xs text-slate-500">
              Plan around your current location, or choose any state, district or taluk in India.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeCard
                active={planMode === "around"}
                onClick={() => setPlanMode("around")}
                icon={<LocateFixed className="h-4 w-4" />}
                title="Around me"
                desc="Use my live location and travel within a chosen distance."
              />
              <ModeCard
                active={planMode === "area"}
                onClick={() => setPlanMode("area")}
                icon={<MapIcon className="h-4 w-4" />}
                title="Choose an area"
                desc="Pick a state, district or taluk anywhere in India."
              />
            </div>
            {planMode === "area" && (
              <div className="mt-4">
                <AreaPicker value={area} onChange={setArea} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 1. Budget */}
            <Card title="1. Your Budget" icon="💰" tone="emerald" className="sm:col-span-2">
              <p className="mb-2 text-3xl font-bold tracking-tight text-slate-900">
                ₹{budget.toLocaleString("en-IN")}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex min-h-[44px] flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-emerald-400 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
                  <span className="mr-1 font-semibold text-slate-400">₹</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={budget}
                    onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                    placeholder="Enter any amount"
                    className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none"
                  />
                </div>
                <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  INR
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={budgetToSlider(budget)}
                onChange={(e) => setBudget(sliderToBudget(Number(e.target.value)))}
                className="mt-4 h-2 w-full cursor-pointer accent-emerald-600"
              />
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400">
                <span>₹1K</span>
                <span>₹5K</span>
                <span>₹10K</span>
                <span>₹20K</span>
                <span>₹50K+</span>
              </div>
            </Card>

            {/* 2. Days */}
            <Card title="2. Number of Days" icon="📅" tone="sky">
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((d) => (
                  <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </Card>

            {/* 3. Travellers */}
            <Card title="3. Number of Travelers" icon="👥" tone="violet">
              <div className="flex flex-wrap gap-2">
                {TRAVELLER_OPTIONS.map((t) => (
                  <Chip key={t} active={travellers === t} onClick={() => pickTravellers(t)} square>
                    {t}
                  </Chip>
                ))}
              </div>
            </Card>

            {/* Places to visit */}
            <Card title="Places to Visit" icon="📍" tone="rose">
              <div className="flex flex-wrap gap-2">
                {PLACES_OPTIONS.map((p) => (
                  <Chip key={p} active={places === p} onClick={() => setPlaces(p)} square>
                    {p}
                  </Chip>
                ))}
              </div>
              <p className="mt-auto pt-3 text-xs text-slate-500">How many stops to include in the trip.</p>
            </Card>

            {/* How far to travel — only relevant for "around me" planning. In
                area mode the distance comes from the chosen state/district/taluk. */}
            {planMode === "around" && (
              <Card title="How Far? (km)" icon="🧭" tone="teal">
                <div className="flex flex-wrap gap-2">
                  {KM_OPTIONS.map((k) => (
                    <Chip key={k} active={km === k} onClick={() => setKm(k)}>
                      {k} km
                    </Chip>
                  ))}
                </div>
                <p className="mt-auto pt-3 text-xs text-slate-500">Search &amp; route within this distance from you.</p>
              </Card>
            )}

            {/* 4. Trip Type + categories to explore */}
            <div className="card-hover rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
              <CardHeader title="4. Trip Type" tone="emerald" icon="🏷️" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {TRIP_TYPES.map(({ key, icon: Icon }) => {
                  const active = tripType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickTripType(key)}
                      className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition active:scale-95 ${
                        active
                          ? "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {key}
                    </button>
                  );
                })}
              </div>

              <p className="mb-1 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
                Which types of places do you want to visit?
              </p>
              <p className="mb-2.5 text-xs text-slate-500">
                Tap to add or remove. Temples, mosques, churches and gurudwaras are each separate — pick exactly what you want.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLACE_GROUPS.map((g) => {
                  const on = groups.has(g.slug);
                  return (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => toggleGroup(g.slug)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                        on
                          ? "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span>{g.emoji}</span>
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Transport */}
            <Card title="5. Preferred Transport" optional icon="🚌" tone="sky">
              <div className="flex flex-wrap gap-2">
                {TRANSPORT.map(({ key, icon: Icon }) => (
                  <Chip key={key} active={transport === key} onClick={() => setTransport(key)}>
                    <span className="flex items-center gap-1">
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {key}
                    </span>
                  </Chip>
                ))}
              </div>
            </Card>

            {/* 6. Food */}
            <Card title="6. Preferred Food" optional icon="🍽️" tone="amber">
              <div className="flex flex-wrap gap-2">
                {FOOD.map((f) => (
                  <Chip key={f} active={food === f} onClick={() => setFood(f)}>
                    {f}
                  </Chip>
                ))}
              </div>
            </Card>
          </div>

          {areaError && (
            <div className="animate-pop rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {areaError}
            </div>
          )}

          <button
            type="submit"
            disabled={geocoding}
            className="group relative flex min-h-[56px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-600 px-6 text-base font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100"
          >
            {!geocoding && <span aria-hidden className="sheen-overlay animate-sheen" />}
            <span className="relative flex items-center gap-2">
              {geocoding ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Locating your area…
                </>
              ) : (
                <>
                  {snapshot ? "Update Plan" : "Continue & Generate Plan"}
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </button>

          <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span className="text-base leading-none">💡</span>
            <span>
              <span className="font-semibold text-slate-800">Tip:</span> The more details you provide,
              the better and more personalized your trip plan will be.
            </span>
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="card-hover rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/30">✦</span>
              Why use Budget Planner?
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {[
                "Best places within your budget",
                "Day-wise itinerary with activities",
                "Estimated cost breakdown",
                "Smart travel suggestions",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="font-medium">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-hover relative overflow-hidden rounded-3xl bg-emerald-600 p-5 shadow-xl shadow-emerald-500/30">
            <span aria-hidden className="sheen-overlay animate-sheen" />
            <p className="relative text-xs font-bold uppercase tracking-[0.15em] text-white/85">Quick Preview</p>
            <p className="relative mt-1 text-3xl font-extrabold tracking-tight text-white">
              ₹{budget.toLocaleString("en-IN")}
            </p>
            <ul className="relative mt-3 space-y-2.5 text-sm font-semibold text-white">
              <li className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-white backdrop-blur">
                  <CalendarDays className="h-4 w-4" />
                </span>
                {days} Trip
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-white backdrop-blur">
                  <Users className="h-4 w-4" />
                </span>
                {travellersNum} Travelers
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-white backdrop-blur">
                  <MapPinned className="h-4 w-4" />
                </span>
                Total budget
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-600">
            <span>Next: Customize your preferences for a better plan</span>
            <span className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </form>

    {snapshot && <LivePlan key={planKey} {...snapshot} />}
    </>
  );
}

// White + green theme — every card icon uses a green tint (kept as distinct
// keys so per-card variety can return later without touching call sites).
const CARD_TONES: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-green-100 text-green-700",
  amber: "bg-emerald-100 text-emerald-700",
  violet: "bg-green-100 text-green-700",
  rose: "bg-emerald-100 text-emerald-700",
  teal: "bg-teal-100 text-teal-700",
};

// Shared header used by every option card so icons, titles and badges line up
// across the whole grid regardless of card height.
function CardHeader({
  title,
  icon,
  tone = "emerald",
  optional,
}: {
  title: React.ReactNode;
  icon: React.ReactNode;
  tone?: keyof typeof CARD_TONES;
  optional?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg ${CARD_TONES[tone]}`}>
        {icon}
      </span>
      <span className="flex-1 text-sm font-extrabold tracking-tight text-slate-900">{title}</span>
      {optional && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
          Optional
        </span>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  optional,
  tone = "emerald",
  className = "",
  children,
}: {
  title: string;
  icon: string;
  optional?: boolean;
  tone?: keyof typeof CARD_TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`card-hover flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <CardHeader title={title} icon={icon} tone={tone} optional={optional} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
        active
          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
          : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
          active ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className={`block text-sm font-bold ${active ? "text-emerald-800" : "text-slate-800"}`}>
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
      </span>
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
  square,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  square?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border text-sm font-semibold transition active:scale-95 ${
        square ? "grid h-11 w-11 place-items-center" : "min-h-[44px] px-4 py-2"
      } ${
        active
          ? "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

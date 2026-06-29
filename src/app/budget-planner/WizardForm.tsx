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
      groups: [...groups],
      includeFood: true,
      maxStops: Math.min(15, Math.max(2, parseInt(places, 10) || 5)),
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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-r from-sky-100 via-emerald-50 to-teal-100">
        <div
          className="absolute inset-y-0 right-0 hidden w-2/3 bg-cover bg-center opacity-90 md:block"
          style={{ backgroundImage: "url('/66245.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sky-100 via-sky-100/85 to-transparent" />
        <div className="relative z-10 max-w-lg p-6 md:p-10">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">Budget Planner</h1>
          <p className="mt-2 text-sm text-slate-600">
            Plan your perfect trip within your budget.
            <br />
            Tell us your preferences and we&apos;ll handle the rest!
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {STEPS.map((s, i) => {
          const active = i === 0;
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                  active ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm font-medium ${active ? "text-slate-900" : "text-slate-400"}`}>
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
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <span>📍</span> Where do you want to go?
            </p>
            <p className="mb-3 text-xs text-slate-500">
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
            <Card title="1. Your Budget" icon="💰">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center rounded-lg border border-slate-300 px-3 py-2">
                  <span className="mr-1 text-slate-500">₹</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={budget}
                    onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                    placeholder="Enter any amount"
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                </div>
                <span className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
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
                className="mt-3 w-full accent-emerald-600"
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>₹1K</span>
                <span>₹5K</span>
                <span>₹10K</span>
                <span>₹20K</span>
                <span>₹50K+</span>
              </div>
            </Card>

            {/* 2. Days */}
            <Card title="2. Number of Days" icon="📅">
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((d) => (
                  <Chip key={d} active={days === d} onClick={() => setDays(d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </Card>

            {/* 3. Travellers */}
            <Card title="3. Number of Travelers" icon="👥">
              <div className="flex flex-wrap gap-2">
                {TRAVELLER_OPTIONS.map((t) => (
                  <Chip key={t} active={travellers === t} onClick={() => setTravellers(t)} square>
                    {t}
                  </Chip>
                ))}
              </div>
            </Card>

            {/* Places to visit */}
            <Card title="Places to Visit" icon="📍">
              <div className="flex flex-wrap gap-2">
                {PLACES_OPTIONS.map((p) => (
                  <Chip key={p} active={places === p} onClick={() => setPlaces(p)} square>
                    {p}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">How many stops to include in the trip.</p>
            </Card>

            {/* How far to travel — only relevant for "around me" planning. In
                area mode the distance comes from the chosen state/district/taluk. */}
            {planMode === "around" && (
              <Card title="How Far? (km)" icon="🧭">
                <div className="flex flex-wrap gap-2">
                  {KM_OPTIONS.map((k) => (
                    <Chip key={k} active={km === k} onClick={() => setKm(k)}>
                      {k} km
                    </Chip>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Search & route within this distance from you.</p>
              </Card>
            )}

            {/* 4. Trip Type + categories to explore */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <span>🏷️</span> 4. Trip Type
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TRIP_TYPES.map(({ key, icon: Icon }) => {
                  const active = tripType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickTripType(key)}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-200 text-slate-600 hover:border-emerald-300"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {key}
                    </button>
                  );
                })}
              </div>

              <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                Which types of places do you want to visit?
              </p>
              <p className="mb-2 text-xs text-slate-500">
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
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
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
            <Card title="5. Preferred Transport" optional icon="🚌">
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
            <Card title="6. Preferred Food" optional icon="🍽️">
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
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {areaError}
            </div>
          )}

          <button
            type="submit"
            disabled={geocoding}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-70"
          >
            {geocoding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Locating your area…
              </>
            ) : (
              <>
                {snapshot ? "Update Plan" : "Continue & Generate Plan"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="rounded-xl bg-sky-50 px-4 py-3 text-xs text-slate-600">
            💡 <span className="font-semibold">Tip:</span> The more details you provide, the
            better and more personalized your trip plan will be.
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="flex items-center gap-2 font-bold text-slate-900">
              <span className="text-emerald-600">✦</span> Why use Budget Planner?
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {[
                "Best places within your budget",
                "Day-wise itinerary with activities",
                "Estimated cost breakdown",
                "Smart travel suggestions",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="font-bold text-emerald-700">Quick Preview</p>
            <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-slate-400" /> {days} Trip
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" /> {travellersNum} Travelers
              </li>
              <li className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-slate-400" /> Budget: ₹ {budget.toLocaleString("en-IN")}
              </li>
            </ul>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-xs text-slate-600">
            <span className="font-medium">Next: Customize your preferences for a better plan</span>
            <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400 text-white">
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

function Card({
  title,
  icon,
  optional,
  children,
}: {
  title: string;
  icon: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="card-hover rounded-3xl border border-slate-200 bg-white p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <span>{icon}</span>
        {title}
        {optional && <span className="text-xs font-normal text-slate-400">(Optional)</span>}
      </p>
      {children}
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
      className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
        active
          ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-200"
          : "border-slate-200 hover:border-emerald-300"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className={`block text-sm font-semibold ${active ? "text-emerald-800" : "text-slate-800"}`}>
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
      className={`rounded-lg border text-sm font-medium transition ${
        square ? "h-9 w-10" : "px-3 py-1.5"
      } ${
        active
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-slate-200 text-slate-600 hover:border-emerald-300"
      }`}
    >
      {children}
    </button>
  );
}

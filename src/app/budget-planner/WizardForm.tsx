"use client";

import Link from "next/link";
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
  Check,
  MapPinned,
  ArrowRight,
  ArrowLeft,
  LocateFixed,
  Route,
  Loader2,
  Wallet,
  Utensils,
} from "lucide-react";

import type { VehicleKind } from "@/lib/budget";
import { PLACE_GROUPS, TRIP_GROUPS } from "@/lib/catalog/place-groups";
import { geocodeArea } from "@/lib/actions/areas";
import { EMPTY_AREA, type AreaSelection } from "./AreaPicker";
import { LivePlan, type LivePlanProps } from "./LivePlan";
import { PersonalFinanceIllustration } from "@/components/illustrations";
import { Reveal } from "@/components/app/Reveal";
import { PageHero } from "@/components/app/PageHero";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// Wizard step slide — direction-aware (custom prop) so Next slides in from
// the right while Back slides in from the left, matching the way each
// button visually points.
const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
};

const STEPS = ["Trip Details", "Preferences", "Travel Style", "Generate Plan"];
const DAY_OPTIONS = ["1 Day", "2 Days", "3 Days", "4 Days", "5+ Days"];
const TRAVELLER_OPTIONS = ["1", "2", "3", "4", "5+"];
const PLACES_OPTIONS = ["3", "4", "5", "6", "8", "10"];
// Minimum distance (km) from the traveller a place must be to count. "0" means
// no minimum — include even the closest spots.
const MIN_DIST_OPTIONS = ["0", "25", "50", "100", "200"];
// Which compass direction to plan towards. "any" = plan in a full circle around
// the traveller; the cardinals restrict the trip to a 90° sector.
const DIRECTIONS = [
  { key: "any", label: "Circle", emoji: "🧭" },
  { key: "north", label: "North", emoji: "⬆️" },
  { key: "east", label: "East", emoji: "➡️" },
  { key: "south", label: "South", emoji: "⬇️" },
  { key: "west", label: "West", emoji: "⬅️" },
];
const SESSION_KEY = "yatra-point/budget-wizard";

// Human label for a distance-band chip: the km value is the floor, the ceiling
// is double it (0 = anywhere nearby, 200 = 200 km and beyond).
function distBandLabel(km: string): string {
  const n = parseInt(km, 10) || 0;
  if (n === 0) return "Anywhere";
  if (n >= 200) return "200+ km";
  return `${n}–${n * 2} km`;
}

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

// Which trip types make sense for a given traveller count: 1 → Solo only (no
// picker shown), 2 → Couple/Family/Friends, 3+ → Family/Friends.
function availableTripTypes(travellersNum: number) {
  if (travellersNum <= 1) return [];
  if (travellersNum === 2) return TRIP_TYPES.filter((t) => t.key !== "Solo");
  return TRIP_TYPES.filter((t) => t.key === "Family" || t.key === "Friends");
}

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
  // Food is optional. When on, the traveller may enter their own trip food
  // budget (₹) — blank means "estimate it for me" (₹350/person/day).
  const [includeFood, setIncludeFood] = useState(true);
  const [foodBudget, setFoodBudget] = useState("");
  const [places, setPlaces] = useState("5");
  // `km` now means the MINIMUM distance (km) a place must be from the traveller.
  const [km, setKm] = useState("0");
  // Compass direction to plan towards ("any" = full circle).
  const [direction, setDirection] = useState("any");
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

  // Which wizard step is showing (0…3). The form is a true step-by-step flow.
  const [step, setStep] = useState(0);
  // Slide direction for the step transition — 1 forward (Next), -1 backward
  // (Back / jumping to an earlier step marker).
  const [stepDir, setStepDir] = useState(1);

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
      if (typeof f.includeFood === "boolean") setIncludeFood(f.includeFood);
      if (typeof f.foodBudget === "string") setFoodBudget(f.foodBudget);
      if (typeof f.places === "string") setPlaces(f.places);
      if (typeof f.km === "string") setKm(f.km);
      if (typeof f.direction === "string") setDirection(f.direction);
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

  // Choosing travellers; 1 traveller auto-selects the Solo trip type, and any
  // trip type that no longer fits the new count falls back to the first that does.
  function pickTravellers(t: string) {
    setTravellers(t);
    const num = t === "5+" ? 5 : parseInt(t, 10) || 2;
    if (num <= 1) {
      pickTripType("Solo");
      return;
    }
    const avail = availableTripTypes(num);
    if (!avail.some((a) => a.key === tripType)) {
      pickTripType(avail[0]?.key ?? "Family");
    }
  }

  function toggleGroup(slug: string) {
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  // Advance to the next step, validating what each step needs before moving on.
  function goNext() {
    setAreaError(null);
    if (step === 0 && planMode === "area" && !area.state) {
      setAreaError("Choose a state to plan in.");
      return;
    }
    if (step === 1 && groups.size === 0 && area.placeIds.length === 0) {
      setAreaError("Pick at least one type of place to visit.");
      return;
    }
    setStepDir(1);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
  function goBack() {
    setAreaError(null);
    setStepDir(-1);
    setStep((s) => Math.max(0, s - 1));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const dirLabel = DIRECTIONS.find((d) => d.key === direction)?.label ?? "Circle";
  const aroundLabel =
    distBandLabel(km) + (direction !== "any" ? ` · ${dirLabel}` : "");
  const whereLabel = planMode === "around" ? `Around me · ${aroundLabel}` : areaLabel(area);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAreaError(null);

    // In "around me" mode the km chip picks a DISTANCE BAND from the traveller:
    // 25 → 25-50 km, 50 → 50-100, 100 → 100-200, 200 → 200 km+, and 0 → anywhere
    // nearby (0-50). `minDistanceKm` is the floor and `reachKm` the ceiling.
    const minKm = parseInt(km, 10) || 0;
    const reachKm = minKm === 0 ? 50 : minKm >= 200 ? 500 : minKm * 2;

    const snap: LivePlanProps = {
      budget,
      people: travellersNum,
      hours: Math.min(120, Math.max(6, daysNum * 9)),
      vehicle: TRANSPORT_VEHICLE[transport] ?? "small_car",
      mode: MODE_BY_TRANSPORT[transport] ?? "any",
      groups: [...groups],
      includeFood,
      // Blank field → let the planner estimate; a number → that exact food budget.
      foodBudget: includeFood && foodBudget.trim() !== "" ? Math.max(0, parseInt(foodBudget, 10) || 0) : null,
      // Return exactly the number of places the traveller asked for (2–15).
      maxStops: Math.min(15, Math.max(2, parseInt(places, 10) || 5)),
      days: daysNum,
      radiusKm: reachKm,
      minDistanceKm: minKm,
      direction,
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
      // Min-distance + direction are relative to the traveller and only apply to
      // "around me" planning — an area plan is centred on the chosen area itself.
      snap.minDistanceKm = 0;
      snap.direction = "any";
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
          fields: { budget, days, travellers, tripType, transport, food, includeFood, foodBudget, places, km, direction, groups: [...groups], planMode, area },
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
    <Reveal as="form" onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5">
      {/* Editorial header — desktop only; mobile uses the page hero above. */}
      <div className="hidden lg:block">
        <PageHero
          eyebrow="Plan smarter, spend less"
          icon={Wallet}
          title={<>Trip <span className="italic">Planner</span></>}
          subtitle={`Plan a trip that fits your budget — ${STEPS.length} quick steps.`}
          action={<PersonalFinanceIllustration className="hidden h-28 w-28 shrink-0 xl:block" />}
        />
      </div>

      {/* Progress bar + clickable step markers */}
      <div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="flex items-start justify-between gap-1">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (i > step) return;
                  setStepDir(i < step ? -1 : 1);
                  setStep(i);
                }}
                disabled={i > step}
                className="flex flex-1 flex-col items-center gap-1.5 text-center disabled:cursor-default"
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition ${
                    active
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                      : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`text-[11px] font-semibold leading-tight ${active ? "text-slate-900" : "text-slate-400"}`}>
                  {s}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current step's fields */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <AnimatePresence mode="wait" custom={stepDir} initial={false}>
      <motion.div
        key={step}
        custom={stepDir}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ── Step 1 · Trip Details ── */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <StepLabel icon={<MapPinned className="h-4 w-4" />}>Where do you want to go?</StepLabel>
              <p className="-mt-1 mb-3 text-xs text-slate-500">
                Plan around your current location, or choose any state, district or taluk in India.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ModeCard active={planMode === "around"} onClick={() => setPlanMode("around")} icon={<LocateFixed className="h-4 w-4" />} title="Around me" desc="Use my live location and travel within a chosen distance." />
                <Link
                  href="/budget-planner/long-trips"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 active:scale-[0.99]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                    <Route className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Long trips from Bangalore</span>
                    <span className="block text-xs text-slate-500">
                      Ready-made multi-day itineraries into Karnataka, Tamil Nadu, Kerala, Andhra Pradesh & Maharashtra.
                    </span>
                  </span>
                </Link>
              </div>
            </div>

            <div>
              <StepLabel icon="💰">Your Budget</StepLabel>
              <p className="mb-2 text-3xl font-bold tracking-tight text-slate-900">₹{budget.toLocaleString("en-IN")}</p>
              <div className="flex items-center gap-2">
                <div className="flex min-h-[44px] flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-emerald-400 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
                  <span className="mr-1 font-semibold text-slate-400">₹</span>
                  <input type="number" min={0} step={1} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} placeholder="Enter any amount" className="w-full bg-transparent text-sm font-bold text-slate-900 outline-none" />
                </div>
                <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">INR</span>
              </div>
              <input type="range" min={0} max={100} step={0.5} value={budgetToSlider(budget)} onChange={(e) => setBudget(sliderToBudget(Number(e.target.value)))} className="mt-4 h-2 w-full cursor-pointer accent-emerald-600" />
              <div className="mt-1.5 flex justify-between text-[11px] font-medium text-slate-400">
                <span>₹1K</span><span>₹5K</span><span>₹10K</span><span>₹20K</span><span>₹50K+</span>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <StepLabel icon="📅">Number of Days</StepLabel>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((d) => (<Chip key={d} active={days === d} onClick={() => setDays(d)}>{d}</Chip>))}
                </div>
              </div>
              <div>
                <StepLabel icon="👥">Travellers</StepLabel>
                <div className="flex flex-wrap gap-2">
                  {TRAVELLER_OPTIONS.map((t) => (<Chip key={t} active={travellers === t} onClick={() => pickTravellers(t)} square>{t}</Chip>))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2 · Preferences ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <StepLabel icon="📍">Places to Visit</StepLabel>
                <div className="flex flex-wrap gap-2">
                  {PLACES_OPTIONS.map((p) => (<Chip key={p} active={places === p} onClick={() => setPlaces(p)} square>{p}</Chip>))}
                </div>
                <p className="pt-2 text-xs text-slate-500">How many stops to include.</p>
              </div>
              {planMode === "around" && (
                <div>
                  <StepLabel icon="📏">Distance band (km)</StepLabel>
                  <div className="flex flex-wrap gap-2">
                    {MIN_DIST_OPTIONS.map((k) => (
                      <Chip key={k} active={km === k} onClick={() => setKm(k)}>
                        {distBandLabel(k)}
                      </Chip>
                    ))}
                  </div>
                  <p className="pt-2 text-xs text-slate-500">
                    How far the trip should range from you — e.g. 50 plans places roughly 50-100 km away.
                  </p>
                </div>
              )}
            </div>

            {planMode === "around" && (
              <div>
                <StepLabel icon="🧭">Which direction?</StepLabel>
                <div className="flex flex-wrap gap-2">
                  {DIRECTIONS.map((d) => (
                    <Chip key={d.key} active={direction === d.key} onClick={() => setDirection(d.key)}>
                      <span className="flex items-center gap-1">
                        <span>{d.emoji}</span>
                        {d.label}
                      </span>
                    </Chip>
                  ))}
                </div>
                <p className="pt-2 text-xs text-slate-500">
                  Plan in a full circle around you, or head one way — e.g. North keeps only places north of you.
                </p>
              </div>
            )}

            {availableTripTypes(travellersNum).length > 0 && (
              <div>
                <StepLabel icon="🏷️">Trip Type</StepLabel>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {availableTripTypes(travellersNum).map(({ key, icon: Icon }) => {
                    const active = tripType === key;
                    return (
                      <button key={key} type="button" onClick={() => pickTripType(key)} className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition active:scale-95 ${active ? "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-500/30" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                        <Icon className="h-5 w-5" />{key}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <p className="mb-2 mt-4 text-xs text-slate-500">
                Which types of places do you want to visit? Tap to add or remove — temples, mosques, churches and gurudwaras are each separate.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLACE_GROUPS.map((g) => {
                  const on = groups.has(g.slug);
                  return (
                    <button key={g.slug} type="button" onClick={() => toggleGroup(g.slug)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition active:scale-95 lg:min-h-[40px] lg:px-3.5 lg:py-2 lg:text-xs ${on ? "border-transparent bg-emerald-600 text-white shadow-md shadow-emerald-500/30" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      <span>{g.emoji}</span>{g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3 · Travel Style ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <StepLabel icon="🚌">Preferred Transport</StepLabel>
              <div className="flex flex-wrap gap-2">
                {TRANSPORT.map(({ key, icon: Icon }) => (
                  <Chip key={key} active={transport === key} onClick={() => setTransport(key)}>
                    <span className="flex items-center gap-1">{Icon && <Icon className="h-3.5 w-3.5" />}{key}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <StepLabel icon="🍽️">Preferred Food</StepLabel>
              <div className="flex flex-wrap gap-2">
                {FOOD.map((f) => (<Chip key={f} active={food === f} onClick={() => setFood(f)}>{f}</Chip>))}
              </div>
            </div>

            {/* Food is optional — turn it off to leave meals out of the budget,
                or enter your own food budget for the trip. */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Utensils className="h-4 w-4 text-emerald-600" /> Include food in my budget
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeFood}
                  onClick={() => setIncludeFood((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${includeFood ? "bg-emerald-500" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${includeFood ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </label>

              {includeFood && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your food budget (optional)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={foodBudget}
                      onChange={(e) => setFoodBudget(e.target.value)}
                      placeholder={`Leave blank to estimate (~₹${(travellersNum * daysNum * 350).toLocaleString("en-IN")})`}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Total food spend for {travellersNum} {travellersNum === 1 ? "traveller" : "travellers"} over {daysNum} {daysNum === 1 ? "day" : "days"}. Blank = we estimate it.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 4 · Review & Generate ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <StepLabel icon={<CheckCircle2 className="h-4 w-4" />}>Review your trip</StepLabel>
              <p className="-mt-1 text-xs text-slate-500">Check the details, then generate your plan. You can jump back to any step to tweak.</p>
            </div>
            <dl className="overflow-hidden rounded-2xl border border-slate-200">
              <SummaryRow label="Where" value={whereLabel || "—"} />
              <SummaryRow label="Budget" value={`₹${budget.toLocaleString("en-IN")}`} />
              <SummaryRow label="Days" value={days} />
              <SummaryRow label="Travellers" value={`${travellersNum}`} />
              <SummaryRow label="Places" value={`${places} stops`} />
              {planMode === "around" && (
                <SummaryRow label="Distance" value={distBandLabel(km)} />
              )}
              {planMode === "around" && direction !== "any" && (
                <SummaryRow label="Direction" value={dirLabel} />
              )}
              <SummaryRow label="Trip type" value={tripType} />
              <SummaryRow label="Transport" value={transport} />
              <SummaryRow label="Food" value={food} />
              <SummaryRow
                label="Food budget"
                value={
                  !includeFood
                    ? "Not included"
                    : foodBudget.trim() !== ""
                    ? `₹${Number(parseInt(foodBudget, 10) || 0).toLocaleString("en-IN")}`
                    : `Estimated (~₹${(travellersNum * daysNum * 350).toLocaleString("en-IN")})`
                }
              />
              <SummaryRow label="Interests" value={`${groups.size} selected`} />
            </dl>
            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="text-base leading-none">💡</span>
              <span><span className="font-semibold text-slate-800">Tip:</span> After generating, you can save the trip or open the whole route in Google Maps.</span>
            </div>
          </div>
        )}
      </motion.div>
      </AnimatePresence>
      </div>

      {areaError && (
        <div className="animate-pop rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {areaError}
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 lg:min-h-[52px] lg:text-sm"
          >
            <ArrowLeft className="h-5 w-5" /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="group flex min-h-[56px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-base font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.01] active:scale-95 lg:min-h-[52px] lg:bg-emerald-600 lg:bg-none lg:text-sm"
          >
            Next <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={geocoding}
            className="group relative flex min-h-[56px] flex-[2] items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-base font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.01] active:scale-95 disabled:opacity-70 lg:min-h-[52px] lg:bg-emerald-600 lg:bg-none lg:text-sm"
          >
            {!geocoding && <span aria-hidden className="sheen-overlay animate-sheen" />}
            <span className="relative flex items-center gap-2">
              {geocoding ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Locating…</>
              ) : (
                <>{snapshot ? "Update Plan" : "Generate Plan"} <ArrowRight className="h-5 w-5" /></>
              )}
            </span>
          </button>
        )}
      </div>
    </Reveal>

    {snapshot && <LivePlan key={planKey} {...snapshot} />}
    </>
  );
}

// Small green-tinted section heading used inside each wizard step.
function StepLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-sm font-extrabold tracking-tight text-slate-900">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-base text-emerald-700">
        {icon}
      </span>
      {children}
    </p>
  );
}

// One row in the review-step summary table.
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-2.5 text-sm last:border-b-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-900">{value}</span>
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
      className={`rounded-full border text-[15px] font-semibold transition active:scale-95 lg:text-sm ${
        square ? "grid h-12 w-12 place-items-center lg:h-11 lg:w-11" : "min-h-[48px] px-5 py-2.5 lg:min-h-[44px] lg:px-4 lg:py-2"
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

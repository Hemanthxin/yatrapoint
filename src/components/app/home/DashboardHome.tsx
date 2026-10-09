"use client";

import "./home.css";
import "@/components/app/journey/journey.css"; // shared keyframes for the cast (blink, wing-beat…)
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";

import { formatINR } from "@/lib/format";
import type { DashboardStats, UpcomingTrip } from "@/lib/queries/trip-plans";
import { MountainScape, DAWN_LAYERS, MOONLIT_LAYERS } from "@/components/storybook/MountainScape";
import { Bear, Cloud } from "@/components/story/scenes";
import { Fox, Owl } from "@/components/app/journey/characters";
import { Basecamp } from "@/components/app/journey/stations";
import { useLiveWeather } from "@/components/app/dashboard3d/WeatherModule";
import { useNearbyPlaces } from "@/components/app/dashboard3d/NearbyModule";
import type { JourneyFestival } from "@/components/app/journey/JourneyStory";
import { CampGround, LanternString, SignPost, type SignLink } from "./camp";
import { CinemaWorld } from "@/components/cinema/CinemaWorld";
import { useCinemaSupport } from "@/components/cinema/useCinemaSupport";
import type { CinemaController } from "@/components/cinema/engine/engine";
import { TodayCards } from "./TodayCards";

type Phase = "dawn" | "morning" | "afternoon" | "golden" | "night";
const PHASES: Phase[] = ["dawn", "morning", "afternoon", "golden", "night"];

function phaseOf(h: number): Phase {
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "afternoon";
  if (h >= 16 && h < 19) return "golden";
  return "night";
}
function greetingOf(h: number): string {
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Hello, night owl";
}
const SUBLINE: Record<Phase, string> = {
  dawn: "The mountains are just waking up — and so is the map.",
  morning: "Fresh air, fresh maps. Where shall we wander today?",
  afternoon: "The road is warm and the day is long. Adventure o'clock.",
  golden: "Golden hour at basecamp — the lanterns are being lit.",
  night: "The stars are out. Perfect for dreaming up the next trip.",
};

/** Where the sun (or moon) sits for a given hour — it really does cross the sky as the day goes by. */
function orbAt(h: number): { x: number; y: number; moon: boolean } {
  if (h >= 5 && h < 19) {
    const f = (h - 5) / 14;
    return { x: 8 + 84 * f, y: 70 - 56 * Math.sin(f * Math.PI), moon: false };
  }
  const g = (((h - 19) % 24) + 24) % 24 / 10;
  return { x: 10 + 80 * Math.min(1, g), y: 66 - 48 * Math.sin(Math.min(1, g) * Math.PI), moon: true };
}

/** The visitor's clock as a position on the 3D world's time-of-day scale. */
function worldTime(h: number): number {
  const stops: [number, number][] = [[4.5, 4], [6.2, 0], [9, 1], [15, 1.3], [17.4, 2], [18.8, 3], [20.5, 4], [28.5, 4]];
  const hh = h < 4.5 ? h + 24 : h;
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ta] = stops[i];
    const [b, tb] = stops[i + 1];
    if (hh >= a && hh <= b) return ta + ((hh - a) / (b - a)) * (tb - ta);
  }
  return 1;
}

const WHO = ["Teddy", "Juno", "Pip"] as const;
const SIGNS: SignLink[] = [
  { href: "/budget-planner", label: "Plan a trip", emoji: "🗺️", hint: { who: 1, text: "Shall I unroll a fresh map?" } },
  { href: "/destinations", label: "Explore places", emoji: "🏞️", hint: { who: 0, text: "Ooh — places we've never seen!" } },
  { href: "/festivals", label: "Festivals", emoji: "🪔", hint: { who: 2, text: "Hoo! Lanterns and sweets!" } },
  { href: "/community", label: "Community", emoji: "🧭", hint: { who: 0, text: "Fellow wanderers — with tales!" } },
];

interface Props {
  firstName: string;
  stats: DashboardStats;
  upcoming: UpcomingTrip[];
  festival: JourneyFestival | null;
}

/** The dashboard's welcome: a painted basecamp that knows the time of day and what you've been up to. */
export function DashboardHome({ firstName, stats, upcoming, festival }: Props) {
  const weather = useLiveWeather();

  // Real-time 3D camp when the device can run it; the painted 2D camp below is the fallback.
  const support = useCinemaSupport();
  const [cineFailed, setCineFailed] = useState(false);
  const cine = support?.ok === true && !cineFailed;
  const [ctl, setCtl] = useState<CinemaController | null>(null);
  const nearby = useNearbyPlaces(4);

  // Real local time — set after mount so server and client markup match.
  const [hour, setHour] = useState<number | null>(null);
  const [dateLine, setDateLine] = useState("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setHour(d.getHours() + d.getMinutes() / 60);
      setDateLine(d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }));
    };
    tick();
    const t = window.setInterval(tick, 60_000);
    return () => window.clearInterval(t);
  }, []);
  // The app's dark theme is "night" for the basecamp too: moon, stars, dark mountains and lit lanterns,
  // whatever the clock says. (Watches <html data-theme>, so the toggle takes effect instantly.)
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.getAttribute("data-theme") === "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  const h = hour ?? 14;
  const phase: Phase = dark ? "night" : phaseOf(Math.floor(h));
  const orb = orbAt(dark ? 22 : h);
  const night = phase === "night";
  // Dark theme during the day: the greeting still follows the real clock, so the line under it
  // acknowledges that the stars came out early rather than claiming it is night.
  const subline = dark && phaseOf(Math.floor(h)) !== "night" ? "Dark mode is on — the stars came out early." : SUBLINE[phase];

  const trips = stats.tripsPlanned;
  const places = stats.placesExplored;
  const saved = stats.totalSaved;
  const lit = Math.min(12, places);
  const nextTrip = stats.upcomingTrip ?? (upcoming[0] ? { name: upcoming[0].name, days: upcoming[0].days } : null);

  // What the companions say, in rotation — all of it drawn from the traveller's own numbers.
  const lines = useMemo(() => {
    const l: { who: 0 | 1 | 2; text: string }[] = [
      { who: 0, text: `${greetingOf(Math.floor(h))}, ${firstName}! Welcome back to basecamp.` },
      {
        who: 1,
        text: trips
          ? `You've drawn ${trips} route${trips === 1 ? "" : "s"}${nextTrip ? ` — next up: ${nextTrip.name}` : ""}.`
          : "The map is still blank. Shall we draw your first route?",
      },
      { who: 2, text: saved > 0 ? `${formatINR(saved)} saved so far. Clink, clink!` : "Plan on a budget and I'll start the coin jar." },
    ];
    if (festival) l.push({ who: 1, text: `${festival.name} is ${festival.days != null && festival.days >= 0 ? `${festival.days} days` : "coming"} away — shall we go?` });
    if (weather) {
      const t = weather.temp;
      l.push({ who: 2, text: `${t}°C out there — ${t >= 32 ? "carry plenty of water!" : t <= 18 ? "bring a jacket!" : "lovely weather for travelling!"}` });
    }
    l.push({ who: 0, text: subline });
    return l;
  }, [h, firstName, trips, nextTrip, saved, festival, weather, subline]);

  const [idx, setIdx] = useState(0);
  const [hint, setHint] = useState<SignLink["hint"] | null>(null);
  useEffect(() => {
    if (hint) return;
    const t = window.setInterval(() => setIdx((i) => i + 1), 5600);
    return () => window.clearInterval(t);
  }, [hint]);
  const say = hint ?? lines[idx % lines.length];

  // keep the 3D world in step with the page: the visitor's clock (or the dark theme), the lanterns they have
  // earned, and whichever companion is talking
  useEffect(() => {
    if (!ctl) return;
    ctl.setTime(dark ? 4 : worldTime(h));
    ctl.setLit(lit);
    ctl.setTalking(say.who);
  }, [ctl, dark, h, lit, say.who]);

  const chips = [
    { e: "🎒", t: `${trips} ${trips === 1 ? "trip" : "trips"} planned`, href: "/trip-history" },
    { e: "🔦", t: `${places} ${places === 1 ? "place" : "places"} explored`, href: "/destinations" },
    { e: "🪙", t: `${formatINR(saved)} saved`, href: "/budget-planner" },
    ...(festival ? [{ e: festival.emoji || "🪔", t: `${festival.name}${festival.days != null && festival.days >= 0 ? ` · ${festival.days}d` : ""}`, href: "/festivals" }] : []),
  ];

  const toStory = () => {
    const el = document.getElementById("journey");
    if (!el) return;
    const lenis = window.__sbLenis;
    if (lenis) lenis.scrollTo(el, { duration: 2, offset: -80 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  const clouds = [
    { l: "6%", t: "9%", w: 300, s: 2, d: 70 },
    { l: "52%", t: "5%", w: 240, s: 5, d: 95 },
    { l: "74%", t: "17%", w: 330, s: 8, d: 82 },
  ];

  return (
    <div className="wh-wrap">
      <section className={`wh ${cine ? "wh--cine" : ""}`} data-phase={phase} data-ready={hour != null} aria-label="Welcome to basecamp">
        {cine && support && <CinemaWorld mode="camp" quality={support.quality} onController={setCtl} onFail={() => setCineFailed(true)} />}
        <div className="wh-skies" aria-hidden>
          {PHASES.map((p) => (
            <i key={p} className={`wh-sky wh-sky-${p} ${p === phase ? "on" : ""}`} />
          ))}
          <span className={`wh-stars ${night ? "on" : phase === "dawn" || phase === "golden" ? "dim" : ""}`} />
          <span className={`wh-orb ${orb.moon ? "moon" : ""}`} style={{ left: `${orb.x}%`, top: `${orb.y}%` }} />
          {clouds.map((c, i) => (
            <div key={i} className="wh-cloud" style={{ left: c.l, top: c.t, animationDuration: `${c.d}s`, animationDelay: `${-i * 21}s`, opacity: night ? 0.35 : 0.95 }}>
              <Cloud w={c.w} seed={c.s} tint={night ? "#8f96c8" : "#ffffff"} shade={night ? "#5d6398" : "#d9e8f0"} />
            </div>
          ))}
        </div>

        <div className="wh-ridges" aria-hidden>
          <MountainScape layers={DAWN_LAYERS} idPrefix="whd" seed={4} className="wh-day" />
          <MountainScape layers={MOONLIT_LAYERS} idPrefix="whn" seed={4} className={`wh-moon ${night ? "on" : ""}`} />
          <span className="wh-tint" />
        </div>

        <LanternString lit={lit} />
        <CampGround />

        <div className="wh-tent" aria-hidden>
          <Basecamp />
        </div>

        <div className="wh-cast">
          <div className={`wh-c wh-juno ${say.who === 1 ? "talk" : ""}`} aria-hidden>
            <Fox />
          </div>
          <div className={`wh-c wh-teddy ${say.who === 0 ? "talk" : ""}`} aria-hidden>
            <Bear />
          </div>
          <div className={`wh-c wh-pip ${say.who === 2 ? "talk" : ""}`} aria-hidden>
            <div className="wh-hover">
              <Owl />
            </div>
          </div>
          <div className={`wh-say who-${say.who}`} key={`${say.who}-${say.text}`} role="status" aria-live="polite">
            <i>{WHO[say.who]}</i>
            {say.text}
          </div>
        </div>

        <SignPost links={SIGNS} onHint={setHint} />

        <div className="wh-card">
          <p className="wh-date">{dateLine || " "}</p>
          <h1>
            {greetingOf(Math.floor(h))}, <em>{firstName}</em>
          </h1>
          <p className="wh-sub">{subline}</p>
          <ul className="wh-chips">
            {chips.map((c) => (
              <li key={c.t}>
                <Link href={c.href}>
                  <span aria-hidden>{c.e}</span>
                  {c.t}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <button type="button" className="wh-cue" onClick={toStory}>
          Your journey story <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      </section>

      <TodayCards weather={weather} nearby={nearby} upcoming={upcoming} phase={phase} />
    </div>
  );
}

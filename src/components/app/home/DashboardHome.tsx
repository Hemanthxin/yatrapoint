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
  const h = hour ?? 14;
  const phase = phaseOf(Math.floor(h));
  const orb = orbAt(h);
  const night = phase === "night";

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
    l.push({ who: 0, text: SUBLINE[phase] });
    return l;
  }, [h, firstName, trips, nextTrip, saved, festival, weather, phase]);

  const [idx, setIdx] = useState(0);
  const [hint, setHint] = useState<SignLink["hint"] | null>(null);
  useEffect(() => {
    if (hint) return;
    const t = window.setInterval(() => setIdx((i) => i + 1), 5600);
    return () => window.clearInterval(t);
  }, [hint]);
  const say = hint ?? lines[idx % lines.length];

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
      <section className="wh" data-phase={phase} data-ready={hour != null} aria-label="Welcome to basecamp">
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
          <p className="wh-sub">{SUBLINE[phase]}</p>
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

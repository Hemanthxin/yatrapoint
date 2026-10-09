"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatKm } from "@/lib/geo";
import type { UpcomingTrip } from "@/lib/queries/trip-plans";
import type { NearPlace } from "@/app/api/nearby-places/route";
import { KIND_EMOJI, kindOf } from "@/app/budget-planner/quest/story-text";
import { Cloud } from "@/components/story/scenes";
import { Fox, Owl } from "@/components/app/journey/characters";

type Phase = "dawn" | "morning" | "afternoon" | "golden" | "night";
interface Weather {
  temp: number;
  humidity: number;
  wind: number;
  aqi: number | null;
}

const hrefFor = (source: NearPlace["source"], slug: string) =>
  source === "destination" ? `/destinations/${slug}` : source === "nearby" ? `/one-day-trips/${slug}` : `/explore-bangalore/${slug}`;

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very bad";
  return "Hazardous";
}

function adviceFor(w: Weather): string {
  if (w.temp >= 34) return "Scorching! Carry water and start early.";
  if (w.humidity >= 85) return "Feels like rain is near — pack a jacket.";
  if (w.wind >= 30) return "Breezy out there — hold onto your hat!";
  if (w.temp >= 30) return "Warm and bright — sunscreen weather.";
  if (w.temp <= 18) return "A little chilly — bring a jacket.";
  return "Lovely weather for travelling!";
}

function dateRange(start: Date | string, days: number): string {
  const s = new Date(start);
  const e = new Date(s.getTime() + Math.max(0, days - 1) * 86_400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return days > 1 ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

/* ─────────────────────────── the three cards ─────────────────────────── */

export function TodayCards({ weather, nearby, upcoming, phase }: { weather: Weather | null; nearby: NearPlace[] | null; upcoming: UpcomingTrip[]; phase: Phase }) {
  return (
    <section className="th" aria-label="Today at camp">
      <h2 className="th-title">
        <span className="sb-eyebrow">Today at camp</span>
      </h2>
      <div className="th-grid">
        <WeatherCard weather={weather} phase={phase} />
        <NextCard upcoming={upcoming} />
        <NearCard nearby={nearby} />
      </div>
    </section>
  );
}

/* ───────── weather: a little painted window onto the day ───────── */
function WeatherCard({ weather, phase }: { weather: Weather | null; phase: Phase }) {
  const night = phase === "night";
  const mood = weather ? (weather.temp >= 32 ? "hot" : weather.temp <= 18 ? "cool" : "mild") : "mild";
  return (
    <article className="card th-card tc-card tc-weather" style={{ animationDelay: "0s" }}>
      <div className={`tc-scene tc-sky-${phase} is-${mood}`}>
        <span className={`tc-orb ${night ? "moon" : ""}`} aria-hidden />
        <i className="tc-cl c1" aria-hidden>
          <Cloud w={150} seed={3} tint={night ? "#8f96c8" : "#ffffff"} shade={night ? "#5d6398" : "#d9e8f0"} />
        </i>
        <i className="tc-cl c2" aria-hidden>
          <Cloud w={110} seed={6} tint={night ? "#8f96c8" : "#ffffff"} shade={night ? "#5d6398" : "#d9e8f0"} />
        </i>
        <p className="tc-label">Right where you are</p>
        {weather ? (
          <p className="tc-temp">
            {weather.temp}
            <small>°C</small>
          </p>
        ) : (
          <p className="tc-temp tc-dim">––</p>
        )}
        <span className="tc-pip" aria-hidden>
          <span>
            <Owl />
          </span>
        </span>
        <p className="tc-bubble">{weather ? adviceFor(weather) : "Pip is peeking out of the window…"}</p>
      </div>

      <div className="tc-tiles">
        <div className="tc-tile">
          <HumidityIcon pct={weather?.humidity ?? 0} />
          <b>{weather ? `${weather.humidity}%` : "—"}</b>
          <small>Humidity</small>
        </div>
        <div className="tc-tile">
          <WindIcon speed={weather?.wind ?? 0} />
          <b>{weather ? `${weather.wind} km/h` : "—"}</b>
          <small>Wind</small>
        </div>
        <div className="tc-tile">
          <AqiIcon aqi={weather?.aqi ?? null} />
          <b>{weather?.aqi != null ? weather.aqi : "—"}</b>
          <small>{weather?.aqi != null ? aqiLabel(weather.aqi) : "Air"}</small>
        </div>
      </div>
    </article>
  );
}

function HumidityIcon({ pct }: { pct: number }) {
  const drop = "M22 4C22 4 8 19 8 28a14 14 0 0 0 28 0C36 19 22 4 22 4Z";
  const y = 42 - (Math.min(100, Math.max(6, pct)) / 100) * 36;
  return (
    <svg viewBox="0 0 44 46" className="tc-ico" aria-hidden>
      <defs>
        <clipPath id="tc-drop">
          <path d={drop} />
        </clipPath>
      </defs>
      <g clipPath="url(#tc-drop)">
        <rect x="0" y={y} width="44" height="46" fill="#5bb8f5" />
        <path className="tc-wave" d={`M-44 ${y}q11 -5 22 0t22 0t22 0t22 0t22 0t22 0t22 0`} fill="#9bd8ff" />
      </g>
      <path d={drop} fill="none" stroke="#2f7fc4" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

function WindIcon({ speed }: { speed: number }) {
  const dur = Math.max(0.6, 2.4 - speed / 20);
  return (
    <svg viewBox="0 0 44 46" className="tc-ico tc-wind" aria-hidden style={{ ["--wd" as string]: `${dur}s` }}>
      <g fill="none" stroke="#6a8fb0" strokeWidth="3" strokeLinecap="round">
        <path d="M4 15h24a6 6 0 1 0-6-6" />
        <path d="M4 24h32a6 6 0 1 1-6 6" />
        <path d="M4 33h16a5 5 0 1 1-5 5" />
      </g>
    </svg>
  );
}

function AqiIcon({ aqi }: { aqi: number | null }) {
  const deg = -90 + Math.min(1, Math.max(0, (aqi ?? 0) / 300)) * 180;
  return (
    <svg viewBox="0 0 44 46" className="tc-ico" aria-hidden>
      <defs>
        <linearGradient id="tc-aqi" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3fcf6a" />
          <stop offset="0.4" stopColor="#f2d33a" />
          <stop offset="0.7" stopColor="#f08a3a" />
          <stop offset="1" stopColor="#d9453a" />
        </linearGradient>
      </defs>
      <path d="M5 34A17 17 0 0 1 39 34" fill="none" stroke="url(#tc-aqi)" strokeWidth="6" strokeLinecap="round" />
      <g className="tc-needle" style={{ transform: `rotate(${deg}deg)`, transformOrigin: "22px 34px" }}>
        <path d="M22 34L22 20" stroke="#3a2d1c" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <circle cx="22" cy="34" r="3.4" fill="#3a2d1c" />
    </svg>
  );
}

/* ───────── next adventure: a boarding pass (or a blank map waiting for a route) ───────── */
function NextCard({ upcoming }: { upcoming: UpcomingTrip[] }) {
  const first = upcoming[0];
  const rest = upcoming.slice(1, 3);
  const confirmed = !!first && !!first.status && first.status !== "draft";
  return (
    <article className="card th-card tc-card tc-next" style={{ animationDelay: "0.12s" }}>
      <header className="tc-head">
        <b>Next adventure</b>
        <span aria-hidden>🎒</span>
      </header>

      {first ? (
        <>
          <div className="tc-ticket">
            <div className="tc-stub">
              <b>{first.days}</b>
              <small>{first.days === 1 ? "DAY" : "DAYS"}</small>
            </div>
            <div className="tc-pass">
              <small>Boarding pass</small>
              <h4>{first.name}</h4>
              <p className="tc-dates">{dateRange(first.createdAt, first.days)}</p>
              <div className="tc-route" aria-hidden>
                <i />
                <span>🧭</span>
                <i />
              </div>
              <span className={`tc-stamp ${confirmed ? "ok" : "wait"}`}>{confirmed ? "Confirmed" : "Pending"}</span>
            </div>
          </div>
          {rest.length > 0 && (
            <ul className="tc-more">
              {rest.map((t) => (
                <li key={t.id}>
                  <span aria-hidden>🏞️</span>
                  <b>{t.name}</b>
                  <em>
                    {t.days} {t.days === 1 ? "day" : "days"}
                  </em>
                </li>
              ))}
            </ul>
          )}
          <Link href="/trip-history" className="th-link">
            See all your trips <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <>
          <div className="tc-blank">
            <svg viewBox="0 0 300 150" aria-hidden>
              <rect x="2" y="2" width="296" height="146" rx="14" fill="#fff4d6" stroke="#b6702f" strokeWidth="2.5" strokeDasharray="6 5" />
              <g fill="none" stroke="#e3cfa0" strokeWidth="2">
                <path d="M2 50H298M2 100H298M75 2V148M150 2V148M225 2V148" />
              </g>
              <path className="tc-trace" d="M30 112C70 70 110 130 150 88S230 50 262 36" fill="none" stroke="#d9582a" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="7 8" />
              <circle cx="30" cy="112" r="6" fill="#3fa856" />
              <g className="tc-x">
                <path d="M254 28l16 16M270 28l-16 16" stroke="#d9453a" strokeWidth="5" strokeLinecap="round" />
              </g>
            </svg>
            <span className="tc-fox" aria-hidden>
              <Fox />
            </span>
          </div>
          <p className="tc-say">
            <b>Juno:</b> the map is blank — let&rsquo;s draw your first route together!
          </p>
          <Link href="/budget-planner" className="btn-primary tc-cta">
            Draw my first route <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      )}
    </article>
  );
}

/* ───────── near you: a trail of places ───────── */
function NearCard({ nearby }: { nearby: NearPlace[] | null }) {
  const items = (nearby ?? []).slice(0, 4);
  const max = Math.max(0.1, ...items.map((p) => p.distanceKm));
  return (
    <article className="card th-card tc-card tc-near" style={{ animationDelay: "0.24s" }}>
      <header className="tc-head">
        <b>Near you</b>
        <svg viewBox="0 0 40 40" className="tc-compass" aria-hidden>
          <circle cx="20" cy="20" r="17" fill="#fff4d6" stroke="#b6702f" strokeWidth="2" />
          <g className="tc-needle2">
            <path d="M20 6l4 14h-8z" fill="#d9453a" />
            <path d="M20 34l-4-14h8z" fill="#5a4a38" />
          </g>
          <circle cx="20" cy="20" r="2" fill="#3a2d1c" />
        </svg>
      </header>

      {nearby === null ? (
        <ul className="tc-trail" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="tc-skel" style={{ animationDelay: `${i * 0.12}s` }}>
              <span className="tc-badge" />
              <div>
                <b />
                <small />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="tc-say">
          <b>Teddy:</b> allow location access and I&rsquo;ll sniff out what&rsquo;s genuinely near you.
        </p>
      ) : (
        <ol className="tc-trail">
          {items.map((p, i) => {
            const kind = kindOf(p.category ?? p.kind ?? "", p.name);
            return (
              <li key={p.id} style={{ animationDelay: `${0.1 + i * 0.09}s` }}>
                <Link href={hrefFor(p.source, p.slug)} className={i === 0 ? "is-first" : undefined}>
                  <span className="tc-badge">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <span aria-hidden>{KIND_EMOJI[kind]}</span>
                    )}
                  </span>
                  <div>
                    <b>{p.name}</b>
                    <small>{p.area || "Close by"}</small>
                    <i className="tc-bar" aria-hidden>
                      <u style={{ width: `${Math.max(12, (p.distanceKm / max) * 100)}%` }} />
                    </i>
                  </div>
                  <em>{formatKm(p.distanceKm)}</em>
                  {i === 0 && <s className="tc-ribbon">closest</s>}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      <Link href="/explore-bangalore" className="th-link">
        Open nearby places <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

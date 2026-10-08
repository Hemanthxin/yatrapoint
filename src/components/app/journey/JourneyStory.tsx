"use client";

import "./journey.css";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Binoculars, Briefcase, CalendarClock, Mountain, Users, Wallet } from "lucide-react";

import { formatINR } from "@/lib/format";
import type { DashboardStats } from "@/lib/queries/trip-plans";
import { Bear, Bird, Cloud, RoadStrip, WideRidges, roadY } from "@/components/story/scenes";
import { Fox, Owl } from "./characters";
import { Basecamp, CoinBridge, FestivalVillage, LanternForest, Summit } from "./stations";

gsap.registerPlugin(ScrollTrigger);

export interface JourneyFestival {
  name: string;
  dateLabel: string;
  emoji: string;
  days: number | null;
}

interface Props {
  firstName: string;
  stats: DashboardStats;
  festival: JourneyFestival | null;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Progress through the walk (after the intro) at which each station's panel is
// fullest. The last one is 1 — the story ends with the Summit in full view.
const PEAK = [0.07, 0.29, 0.51, 0.74, 1];
const INTRO = 0.14;
const WHO = ["Teddy", "Juno", "Pip"] as const;
const ROMAN = ["I", "II", "III", "IV", "V"];

const DAY_SKY = { a: ["#62c4f6", "#fff0b0", "#fffadc"], b: ["#6a4cb0", "#f0708a", "#ffbc7a"] };
const NIGHT_SKY = { a: ["#222a68", "#1a2052", "#141a42"], b: ["#090d29", "#121744", "#1d1f55"] };

function Chars({ text }: { text: string }) {
  return (
    <span aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span className="jr-w" key={i} aria-hidden>
          {[...w].map((c, j) => (
            <span className="jr-c" key={j}>
              {c}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export function JourneyStory({ firstName, stats, festival }: Props) {
  const root = useRef<HTMLElement>(null);
  const [dims, setDims] = useState<{ vw: number; vh: number } | null>(null);
  const [say, setSay] = useState<{ who: 0 | 1 | 2; text: string } | null>(null);
  const [act, setAct] = useState(-1);
  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  /* ───────── the story's data ───────── */
  const trips = stats.tripsPlanned;
  const places = stats.placesExplored;
  const saved = stats.totalSaved;
  const planned = stats.totalBudget;
  const nextTrip = stats.upcomingTrip;
  const lit = Math.min(12, places);
  const ratio = planned > 0 ? clamp(saved / planned) : saved > 0 ? 0.4 : 0;

  const stations = [
    {
      name: "Basecamp",
      big: trips,
      fmt: "int",
      unit: trips === 1 ? "trip planned" : "trips planned",
      text: trips ? "Every route you've drawn hangs on this board." : "The board is still blank — your first route is one click away.",
      href: "/budget-planner",
      cta: "Open the trip planner",
      icon: Briefcase,
    },
    {
      name: "Lantern Forest",
      big: places,
      fmt: "int",
      unit: places === 1 ? "place explored" : "places explored",
      text: places ? `${lit} of 12 lanterns glow — one for each place you've saved.` : "Every place you save lights a lantern. The forest is waiting.",
      href: "/destinations",
      cta: "Explore destinations",
      icon: Binoculars,
    },
    {
      name: "Coin Bridge",
      big: saved,
      fmt: "inr",
      unit: "saved so far",
      text: planned > 0 ? `Out of ${formatINR(planned)} planned — the stack grows as you plan smarter.` : "Plan a budget trip and watch the coins pile up.",
      href: "/budget-planner",
      cta: "Plan on a budget",
      icon: Wallet,
    },
    {
      name: "Festival Village",
      big: festival?.days != null && festival.days >= 0 ? festival.days : 0,
      fmt: "int",
      unit: festival ? `days to ${festival.name}` : "lanterns all year",
      text: festival ? `${festival.name} · ${festival.dateLabel}. The bunting is already up.` : "Festivals light up the map all year round.",
      href: "/festivals",
      cta: "See the festival calendar",
      icon: CalendarClock,
    },
    {
      name: "The Summit",
      big: nextTrip ? nextTrip.days : 0,
      fmt: "int",
      unit: nextTrip ? (nextTrip.days === 1 ? "day on the road" : "days on the road") : "page still unwritten",
      text: nextTrip ? `Next on your map: ${nextTrip.name}.` : "Your summit isn't chosen yet — pick the first step and the path lights up.",
      href: nextTrip ? "/trip-history" : "/budget-planner",
      cta: nextTrip ? "Open your trips" : "Plan your next trip",
      icon: Mountain,
    },
  ];

  // Three short quips per station: [Teddy, Juno, Pip]
  const quips: string[][] = [
    ["Warm fire, packed bag — ready!", trips ? `I've drawn ${trips} route${trips === 1 ? "" : "s"} so far.` : "Fresh map, no routes yet. Shall we?", "Pack light. Budgets love light bags."],
    ["Look at all those lanterns!", places ? `${places} place${places === 1 ? "" : "s"} explored — each lights a lantern.` : "Every place you save lights one.", "Hoo — hidden spots are the best ones."],
    ["Careful, it's slippery!", "A good plan crosses cheap rivers.", saved ? `${formatINR(saved)} saved. Clink, clink!` : "No coins yet — but I'm patient."],
    ["Do I smell sweets?", festival ? `${festival.name} is ${festival.days ?? "a few"} days away!` : "Festivals are best with company.", "Hoo-ray! Lanterns everywhere."],
    ["We made it!", nextTrip ? `Next stop: ${nextTrip.name}.` : "Where shall we draw next?", "The view is free. Always."],
  ];
  const intro = [`Hi ${firstName}! I carry the lantern.`, "I'm Juno — I draw your maps.", "Pip here. I count every coin."];

  /* ───────── measure ───────── */
  useLayoutEffect(() => {
    let t: number | undefined;
    const measure = () => {
      const st = root.current?.querySelector<HTMLElement>(".jr-stage");
      if (!st) return;
      const w = st.clientWidth;
      const h = st.clientHeight;
      // a display:none stage measures 0×0 — there is nothing to build until it is actually visible
      if (w < 200 || h < 200) {
        setDims(null);
        return;
      }
      setDims({ vw: w, vh: h });
    };
    measure();
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const d = dimsRef.current;
        const st = root.current?.querySelector<HTMLElement>(".jr-stage");
        if (!d || !st || Math.abs(st.clientWidth - d.vw) > 40 || Math.abs(st.clientHeight - d.vh) > 80) measure();
      }, 280);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, []);

  /* ───────── choreography ───────── */
  useLayoutEffect(() => {
    if (!dims || !root.current) return;
    const { vw, vh } = dims;
    (root.current as HTMLElement).style.setProperty("--jv", `${vh / 100}px`);
    // pin just under the fixed app header (AppShell publishes its height as --app-header-h)
    const headerPx = () => Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-h")) || 0);
    const s = vh / 900;
    const T = Math.round(vw * 4.8);
    const L = Math.round(T * 0.92 + vh * 0.6);

    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root.current as HTMLElement);
      const one = (sel: string) => q(sel)[0] as HTMLElement;
      const stage = one(".jr-stage");

      const tH = vh * 0.27;
      const fH = vh * 0.235;
      const oH = vh * 0.1;
      const tW = (tH * 170) / 230;
      const fW = (fH * 200) / 224;
      const oW = (oH * 140) / 150;
      const teddy = one(".jr-teddy"), juno = one(".jr-juno"), pip = one(".jr-pip");
      gsap.set(teddy, { width: tW, height: tH });
      gsap.set(juno, { width: fW, height: fH });
      gsap.set(pip, { width: oW, height: oH });

      const tX = vw * 0.36; // Teddy's resting centre
      const jX = vw * 0.21; // Juno's
      const pX = vw * 0.43; // Pip hovers just ahead

      const strips = [
        { el: one(".jr-cloud"), f: 0.06 },
        { el: one(".jr-far"), f: 0.12 },
        { el: one(".jr-mid"), f: 0.34 },
        { el: one(".jr-road"), f: 1 },
        { el: one(".jr-fore"), f: 1.38 },
      ];
      const stEls = q(".jr-station") as HTMLElement[];
      // a station is ahead of Teddy by this much when its panel peaks (panel sits at 0.68·vw)
      const LEAD = (0.32 * vw) / T;
      const stX = PEAK.map((pk) => tX + (pk + LEAD) * T);
      stEls.forEach((el, k) => gsap.set(el, { x: stX[k], y: roadY(stX[k] / s) * s }));

      const legs = {
        t: [one(".br-leg-b"), one(".br-leg-f"), one(".br-arm"), one(".br-scarf")],
        j: [one(".fx-leg-b"), one(".fx-leg-f"), one(".fx-tail"), one(".fx-scarf")],
      };
      const sky = one(".jr-sky");
      const orb = one(".jr-orb");
      const stars = one(".jr-stars");
      const top = one(".jr-top");
      const dot = one(".jr-mark");
      const counted = [false, false, false, false, false];
      let lastAct = -2;
      let lastSay = "";

      const ease = gsap.parseEase("power2.out");
      const mix = (a: string[], b: string[], t: number) => a.map((c, i) => gsap.utils.interpolate(c, b[i], t) as string);

      const walker = (el: HTMLElement, sx: number, dist: number, parts: HTMLElement[], tail = false, phase = 0) => {
        const wx = sx + dist; // world x under the character
        const fy = roadY(wx / s) * s;
        const slope = (roadY(wx / s + 6) - roadY(wx / s - 6)) / 12;
        const sw = Math.sin(dist / 70 + phase);
        const w = parseFloat(el.style.width) || el.offsetWidth;
        const h = parseFloat(el.style.height) || el.offsetHeight;
        gsap.set(el, { x: sx - w / 2, y: fy - h * 0.98 - Math.abs(sw) * 5, rotation: Math.atan(slope) * 26 });
        const cs = Math.cos(dist / 70 + phase);
        // swing from the hip, and lift whichever foot is travelling forward
        if (parts[0]) gsap.set(parts[0], { rotation: sw * 16, y: -Math.max(0, -cs) * 5 });
        if (parts[1]) gsap.set(parts[1], { rotation: -sw * 16, y: -Math.max(0, cs) * 5 });
        if (parts[2]) gsap.set(parts[2], { rotation: tail ? Math.sin(dist / 40 + phase) * 9 : sw * -6 });
        if (parts[3]) gsap.set(parts[3], { rotation: Math.sin(dist / 140 + 1) * 9 });
      };

      const place = (p: number) => {
        const ti = clamp(p / INTRO);
        const pw = clamp((p - INTRO) / (1 - INTRO));
        strips.forEach(({ el, f }) => gsap.set(el, { x: -pw * f * T }));

        // companions: walk in during the intro, then keep pace with the world
        const tx = lerp(-vw * 0.22, tX, ease(clamp(ti * 1.05)));
        const jx = lerp(-vw * 0.4, jX, ease(clamp(ti * 1.1 - 0.05)));
        const px = lerp(-vw * 0.1, pX, ease(clamp(ti * 1.0)));
        const walked = pw * T;
        walker(teddy, tx, walked + (tx + vw * 0.22), legs.t, false, 0);
        walker(juno, jx, walked + (jx + vw * 0.4), legs.j, true, 1.7);
        // Pip hovers above and ahead, swooping down from the sky on arrival
        const py = roadY((px + walked) / s) * s - tH * 1.18 - (1 - ease(ti)) * vh * 0.35;
        gsap.set(pip, { x: px - oW / 2, y: py });

        // sky, sun/moon & stars follow the day
        const night = document.documentElement.getAttribute("data-theme") === "dark";
        const pal = night ? NIGHT_SKY : DAY_SKY;
        const [c1, c2, c3] = mix(pal.a, pal.b, pw);
        sky.style.setProperty("--k1", c1);
        sky.style.setProperty("--k2", c2);
        sky.style.setProperty("--k3", c3);
        gsap.set(orb, { left: `${14 + 72 * pw}%`, top: `${60 - 44 * Math.sin(pw * Math.PI)}%` });
        gsap.set(stars, { opacity: night ? 1 : clamp((pw - 0.62) / 0.3) * 0.9 });
        gsap.set(top, { opacity: 1 - clamp((p - 0.07) / 0.07), y: -clamp((p - 0.07) / 0.07) * 24 });
        gsap.set(dot, { left: `${p * 100}%` });

        // stations: proximity drives panel, lighting and the counters
        let nearest = -1;
        let best = 0.3;
        stEls.forEach((el, k) => {
          const sx = stX[k] - pw * T;
          const n = clamp(1 - Math.abs(sx - vw * 0.68) / (vw * 0.26));
          el.style.setProperty("--n", n.toFixed(3));
          el.classList.toggle("is-near", n > 0.4);
          if (n > 0.4) el.classList.add("is-seen");
          if (n > best) {
            best = n;
            nearest = k;
          }
          if (n > 0.45 && !counted[k]) {
            counted[k] = true;
            const num = el.querySelector<HTMLElement>(".jr-num");
            if (num) {
              const end = Number(num.dataset.v || 0);
              const inr = num.dataset.fmt === "inr";
              const o = { v: 0 };
              gsap.to(o, {
                v: end,
                duration: 1.6,
                ease: "power3.out",
                onUpdate: () => (num.textContent = inr ? formatINR(Math.round(o.v)) : Math.round(o.v).toLocaleString("en-IN")),
              });
            }
          }
        });
        if (nearest !== lastAct) {
          lastAct = nearest;
          setAct(nearest);
        }

        // who is talking?
        let next: { who: 0 | 1 | 2; text: string } | null = null;
        if (p > 0.035 && p <= INTRO + 0.01) {
          const u = clamp((p - 0.035) / (INTRO - 0.03));
          const w = Math.min(2, Math.floor(u * 3)) as 0 | 1 | 2;
          next = { who: w, text: intro[w] };
        } else if (pw > 0) {
          PEAK.forEach((pk, k) => {
            const u = (pw - (pk - (k === PEAK.length - 1 ? 0.17 : 0.085))) / 0.17;
            if (u >= 0 && u <= 1) {
              const w = Math.min(2, Math.floor(u * 3)) as 0 | 1 | 2;
              next = { who: w, text: quips[k][w] };
            }
          });
        }
        const sig = next ? `${(next as { who: number }).who}|${(next as { text: string }).text}` : "";
        if (sig !== lastSay) {
          lastSay = sig;
          setSay(next);
        }
      };

      // gentle entrance for the heading
      gsap.from(".jr-top .jr-c", { yPercent: 118, rotate: 6, duration: 1.1, stagger: 0.035, ease: "power3.out", scrollTrigger: { trigger: stage, start: "top 75%", once: true } });

      // endless ambient life — clouds and birds drift regardless of scroll
      q(".jr-cl").forEach((c, i) => gsap.to(c, { x: (i % 2 ? -1 : 1) * 90, duration: 22 + i * 5, ease: "sine.inOut", repeat: -1, yoyo: true }));
      q(".jr-bird").forEach((b, i) => {
        gsap.fromTo(b, { x: -120 }, { x: vw + 120, duration: 24 + i * 7, ease: "none", repeat: -1, delay: i * 6 });
        gsap.to(b.querySelector("svg"), { y: -12, duration: 1.3 + i * 0.3, ease: "sine.inOut", repeat: -1, yoyo: true });
      });

      place(0);
      const st = ScrollTrigger.create({
        trigger: stage,
        start: () => `top ${headerPx()}px`,
        end: () => `+=${L}`,
        pin: true,
        onUpdate: (self) => place(self.progress),
        onRefresh: (self) => place(self.progress),
      });

      // clicking a station on the track walks you there
      q(".jr-node").forEach((n, k) => {
        n.onclick = () => {
          // bring the station to Teddy's reading position (≈ where its panel is fullest)
          const target = st.start + (INTRO + (1 - INTRO) * PEAK[k]) * (st.end - st.start);
          const lenis = window.__sbLenis;
          if (lenis) lenis.scrollTo(target, { duration: 2.4 });
          else window.scrollTo({ top: target, behavior: "smooth" });
        };
      });

      // reduced motion: freeze every endless loop; the scroll itself still drives the walk
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.globalTimeline.getChildren(true, true, false).forEach((tw) => {
          if (tw.repeat() === -1) tw.pause();
        });
      }
      document.fonts?.ready.then(() => ScrollTrigger.refresh());
    }, root);
    return () => ctx.revert();
    // the story's numbers are baked into the DOM; a data change remounts the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  /* ───────── render ───────── */
  const w = dims?.vw ?? 1440;
  const h = dims?.vh ?? 900;
  const s = h / 900;
  const T = Math.round(w * 4.8);
  const units = (f: number) => Math.round((w + f * T) / s);

  const arts = [<Basecamp key="a" />, <LanternForest key="b" lit={lit} />, <CoinBridge key="c" ratio={ratio} />, <FestivalVillage key="d" emoji={festival?.emoji ?? "🪔"} />, <Summit key="e" />];
  const stars = Array.from({ length: 70 }, (_, i) => ({ l: (i * 137.5) % 100, t: (i * 61.8) % 62, d: (i % 9) * 0.4 }));
  const links = [
    { href: "/budget-planner", t: "Trip Planner", d: "Plan a trip within budget", i: Wallet },
    { href: "/destinations", t: "Tourist Places", d: "Explore top places by state", i: Binoculars },
    { href: "/festivals", t: "Festivals & Events", d: "What's glowing next", i: CalendarClock },
    { href: "/community", t: "Community", d: "Share tips & hidden gems", i: Users },
  ];

  return (
    <section ref={root} id="journey" className="jr">
      <div className="jr-stage">
        <div className="jr-sky" aria-hidden>
          <div className="jr-stars">
            {stars.map((st, i) => (
              <i key={i} style={{ left: `${st.l}%`, top: `${st.t}%`, animationDelay: `${st.d}s` }} />
            ))}
          </div>
          <span className="jr-orb" />
        </div>

        {dims && (
          <>
            <div className="jr-strip jr-cloud" style={{ width: Math.round(w + 0.06 * T) }} aria-hidden>
              {[6, 28, 50, 72, 92].map((p, i) => (
                <div key={i} className="jr-cl" style={{ left: `${p}%`, top: `${7 + (i % 3) * 8}%` }}>
                  <Cloud w={250 + i * 30} seed={40 + i} tint="#ffffff" shade="#d9e8f0" />
                </div>
              ))}
              {[0, 1, 2].map((i) => (
                <div key={i} className="jr-bird" style={{ top: `${12 + i * 7}%` }}>
                  <Bird s={0.9 - i * 0.15} />
                </div>
              ))}
            </div>
            <div className="jr-strip jr-far" style={{ width: Math.round(w + 0.12 * T) }} aria-hidden>
              <WideRidges
                widthUnits={units(0.12)}
                seed={61}
                idp="jf"
                layers={[
                  { color: "#a6dcf4", fade: "#e8f7e0", shade: "#86c4e4", base: 600, amp: 260, peaksPer1600: 3 },
                  { color: "#86d8c4", fade: "#dcf6c6", shade: "#62c2ac", base: 660, amp: 200, peaksPer1600: 4 },
                ]}
              />
            </div>
            <div className="jr-strip jr-mid" style={{ width: Math.round(w + 0.34 * T) }} aria-hidden>
              <WideRidges
                widthUnits={units(0.34)}
                seed={74}
                idp="jm"
                layers={[
                  { color: "#6fd08a", fade: "#cbf0a2", shade: "#4fb86e", base: 690, amp: 130, peaksPer1600: 5, trees: "pine", treeColor: "#2fa860", treeDensity: 36 },
                  { color: "#52c070", fade: "#b4e48c", shade: "#38a458", base: 770, amp: 90, peaksPer1600: 6, trees: "oak", treeColor: "#3aa850", treeDensity: 26 },
                ]}
              />
            </div>
            <div className="jr-night" aria-hidden />
            <div className="jr-strip jr-road" style={{ width: Math.round(w + T) }}>
              <RoadStrip widthUnits={units(1)} seed={13} />
              {stations.map((st, k) => {
                const Icon = st.icon;
                return (
                  <div className="jr-station" key={st.name}>
                    <div className="jr-st-art">{arts[k]}</div>
                    <div className="jr-panel">
                      <span className="jr-no">{ROMAN[k]}</span>
                      <h3>
                        <Icon className="h-4 w-4" aria-hidden /> {st.name}
                      </h3>
                      <p className="jr-big">
                        <b className="jr-num" data-v={st.big} data-fmt={st.fmt}>
                          0
                        </b>
                        <small>{st.unit}</small>
                      </p>
                      <p className="jr-txt">{st.text}</p>
                      <Link href={st.href} className="jr-link">
                        {st.cta} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="jr-char jr-juno" aria-hidden>
              <Fox />
              {say?.who === 1 && (
                <div className="jr-say" key={say.text}>
                  <i>{WHO[1]}</i>
                  {say.text}
                </div>
              )}
            </div>
            <div className="jr-char jr-teddy" aria-hidden>
              <Bear />
              {say?.who === 0 && (
                <div className="jr-say" key={say.text}>
                  <i>{WHO[0]}</i>
                  {say.text}
                </div>
              )}
            </div>
            <div className="jr-char jr-pip" aria-hidden>
              <div className="jr-hover">
                <Owl />
              </div>
              {say?.who === 2 && (
                <div className="jr-say" key={say.text}>
                  <i>{WHO[2]}</i>
                  {say.text}
                </div>
              )}
            </div>

            <div className="jr-strip jr-fore" style={{ width: Math.round(w + 1.38 * T) }} aria-hidden>
              <svg viewBox={`0 0 ${units(1.38)} 900`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                <g filter="url(#sb-wash)">
                  <path
                    d={(() => {
                      const W = units(1.38);
                      let d = "M0 910V860";
                      for (let x = 0; x <= W; x += 46) d += `L${x} ${(852 + 18 * Math.sin(x / 90) + (x % 3) * 6).toFixed(0)}L${x + 22} ${(826 - ((x / 46) % 4) * 8).toFixed(0)}`;
                      return d + `L${W} 910Z`;
                    })()}
                    fill="#2f5f3a"
                  />
                </g>
              </svg>
            </div>
          </>
        )}

        <div className="jr-top">
          <p className="sb-eyebrow">A story of your journey</p>
          <h2>
            <Chars text={`The Journey of ${firstName}`} />
          </h2>
          <p className="jr-sub">Scroll to walk with Teddy, Juno and Pip.</p>
        </div>
        <div className={`jr-where ${act >= 0 ? "is-on" : ""}`} aria-live="polite">
          {act >= 0 && (
            <span key={act}>
              <b>{ROMAN[act]}</b> {stations[act].name}
            </span>
          )}
        </div>

        <div className="jr-track" role="navigation" aria-label="Journey stations">
          <span className="jr-rail" />
          <span className="jr-mark" />
          {stations.map((st, k) => (
            <button key={st.name} type="button" className={`jr-node ${act === k ? "is-on" : ""}`} style={{ left: `${(INTRO + (1 - INTRO) * PEAK[k]) * 100}%` }} aria-label={`Go to ${st.name}`}>
              <i />
              <span>{st.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* after the walk: where to next */}
      <div className="jr-next">
        <div className="jr-next-in">
          <p className="sb-eyebrow">The next page is yours</p>
          <h2>Where would you like to walk next?</h2>
          <div className="jr-next-grid">
            {links.map(({ href, t, d, i: Icon }) => (
              <Link key={href} href={href} className="card card-hover jr-next-card">
                <span className="jr-next-ico">
                  <Icon className="h-5 w-5" />
                </span>
                <b>{t}</b>
                <span>{d}</span>
                <ArrowRight className="jr-next-arrow h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

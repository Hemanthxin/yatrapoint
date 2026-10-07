"use client";

import "./story.css";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DAWN_LAYERS, MountainScape, type ScapeLayer } from "@/components/storybook/MountainScape";
import { LogoMark } from "@/components/Logo";
import {
  Bear,
  Bird,
  Cloud,
  Cottage,
  FestivalWheel,
  GateArch,
  GateBackdrop,
  GateFore,
  GateMid,
  MONTHS,
  RealmArt,
  RoadStrip,
  WideRidges,
  roadY,
  type RealmKind,
} from "./scenes";

gsap.registerPlugin(ScrollTrigger);

/* ────────────────────────────── data ────────────────────────────── */

export interface StoryData {
  places: number;
  states: string[];
  festivals: { name: string; month: number; dateLabel: string; emoji: string }[];
  categories: { slug: string; label: string; emoji: string }[];
  festivalCount: number;
}

const BLURB: Record<string, string> = {
  pilgrimage: "Bells in the mist, lamps on the river — temples where the journey itself is the prayer.",
  adventure: "Ridgelines, rapids and a tent pitched beneath far too many stars.",
  beach: "Salt wind, slow tides and a boat that waits for no timetable.",
  hill_station: "Tea terraces in the clouds, and cottages whose chimneys always smoke.",
  heritage: "Forts that remember their kings, and old stone that still hums with stories.",
  wildlife: "Where the jungle keeps its own time — and guards its own secrets.",
};

const SIGNS = [
  { t: "The Budget Map", d: "Tell us your coins and your days — we'll draw the route." },
  { t: "One-Day Escapes", d: "Mornings that end in waterfalls, home before the lamps are lit." },
  { t: "Hidden Places", d: "Corners of India no signpost bothered to mention." },
  { t: "Festival Lanterns", d: "Know which village glows tonight, and plan to be there." },
  { t: "Fellow Wanderers", d: "Group trips, shared maps and a campfire's worth of company." },
];

const CHAPTERS = [
  { id: "hero", n: "I", t: "The Waking Mountains", sky: ["#a7b6da", "#f2c6bc", "#fbe0b8"] },
  { id: "prologue", n: "II", t: "The Prologue", sky: ["#f6e7c8", "#f3dfb6", "#efd5a2"] },
  { id: "gate", n: "III", t: "The Gate", sky: ["#12302f", "#1f4a42", "#3b6b55"] },
  { id: "road", n: "IV", t: "The Wanderer's Road", sky: ["#8cc3d8", "#f1e2a7", "#f8efca"] },
  { id: "voices", n: "V", t: "Names the Wind Whispers", sky: ["#47306a", "#c0627a", "#f4a374"] },
  { id: "realms", n: "VI", t: "The Six Realms", sky: ["#16214a", "#2b3a78", "#6a6aa6"] },
  { id: "wheel", n: "VII", t: "The Wheel of Festivals", sky: ["#0e1330", "#1a1f4d", "#2c2a62"] },
  { id: "finale", n: "VIII", t: "Epilogue", sky: ["#080b20", "#10153a", "#1b1f4f"] },
] as const;

const DUSK_LAYERS: ScapeLayer[] = [
  { color: "#6a4a86", fade: "#c0627a", shade: "#4e3568", base: 640, amp: 250, peaks: 5, snow: true },
  { color: "#4a3468", fade: "#a8527a", shade: "#352450", base: 740, amp: 210, peaks: 6 },
  { color: "#2d2250", fade: "#6a3a68", shade: "#201840", base: 840, amp: 160, peaks: 7, trees: "pine", treeColor: "#1a1238", treeCount: 70, treeSize: [34, 70] },
];

const NIGHT_LAYERS: ScapeLayer[] = [
  { color: "#27306a", fade: "#161b45", shade: "#1d2556", base: 620, amp: 260, peaks: 5, snow: true },
  { color: "#1d2558", fade: "#12163a", shade: "#161d46", base: 730, amp: 220, peaks: 6 },
  { color: "#141a42", fade: "#0b0f2a", shade: "#0e1334", base: 840, amp: 170, peaks: 7, trees: "pine", treeColor: "#0a0e2a", treeCount: 80, treeSize: [34, 74] },
];

/* ────────────────────────────── helpers ────────────────────────────── */

function Chars({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((w, wi) => (
        <span className="st-w" key={wi} aria-hidden>
          {[...w].map((c, ci) => (
            <span className="st-c" key={ci}>
              {c}
            </span>
          ))}
          {" "}
        </span>
      ))}
    </span>
  );
}

function Words({ text, cls }: { text: string; cls: string }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span className={cls} key={i}>
          {w}{" "}
        </span>
      ))}
    </>
  );
}

function goTo(target: string | number) {
  const l = window.__sbLenis;
  if (l) l.scrollTo(target as never, { duration: 2.2, easing: (t: number) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === "string") document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
  else window.scrollTo({ top: target, behavior: "smooth" });
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ────────────────────────────── component ────────────────────────────── */

export function StoryLanding({ data, auth }: { data: StoryData; auth: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ vw: number; vh: number } | null>(null);
  const [realm, setRealm] = useState(0);
  const [month, setMonth] = useState(() => {
    const ms = data.festivals.map((f) => f.month);
    return ms.length ? Math.min(...ms) : 0;
  });
  const [toc, setToc] = useState(false);
  const introDone = useRef(false);

  const states = useMemo(
    () =>
      data.states.length
        ? data.states
        : ["Karnataka", "Kerala", "Tamil Nadu", "Maharashtra", "Rajasthan", "Goa", "Himachal Pradesh", "Uttarakhand", "Meghalaya", "Sikkim"],
    [data.states],
  );
  const byMonth = useMemo(() => {
    const m: StoryData["festivals"][] = Array.from({ length: 12 }, () => []);
    data.festivals.forEach((f) => m[f.month]?.push(f));
    return m;
  }, [data.festivals]);
  const span = useMemo(() => {
    const ms = data.festivals.map((f) => f.month);
    return ms.length ? { first: Math.min(...ms), last: Math.max(...ms) } : { first: 0, last: 11 };
  }, [data.festivals]);
  const emojiByMonth = useMemo(() => byMonth.map((l) => l[0]?.emoji ?? ""), [byMonth]);

  /* measure once + on (debounced) resize */
  useLayoutEffect(() => {
    let t: number | undefined;
    const measure = () => setDims({ vw: window.innerWidth, vh: window.innerHeight });
    measure();
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (Math.abs(window.innerWidth - (dimsRef.current?.vw ?? 0)) > 40 || Math.abs(window.innerHeight - (dimsRef.current?.vh ?? 0)) > 80) measure();
      }, 280);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, []);
  const dimsRef = useRef(dims);
  dimsRef.current = dims;

  /* never leave the page scroll-locked if we unmount mid-intro */
  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
      window.__sbLenis?.start();
    },
    [],
  );

  const setRealmStable = useCallback((i: number) => setRealm((p) => (p === i ? p : i)), []);
  const setMonthStable = useCallback((i: number) => setMonth((p) => (p === i ? p : i)), []);

  /* ─────────────────────── the whole choreography ─────────────────────── */
  useLayoutEffect(() => {
    if (!dims || !root.current) return;
    const { vw, vh } = dims;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(root.current as HTMLElement);
      const one = (s: string) => q(s)[0] as HTMLElement | undefined;

      /* ── sky: one fixed painting whose colours follow the story ── */
      const globalTriggers = () => {
      const sky = one(".st-sky") as HTMLElement;
      const setSky = (c: readonly string[]) => {
        sky.style.setProperty("--s1", c[0]);
        sky.style.setProperty("--s2", c[1]);
        sky.style.setProperty("--s3", c[2]);
      };
      setSky(CHAPTERS[0].sky);
      const stars = one(".st-stars") as HTMLElement;
      CHAPTERS.forEach((c, i) => {
        if (i === 0) return;
        const prev = CHAPTERS[i - 1].sky;
        ScrollTrigger.create({
          trigger: `#${c.id}`,
          start: "top 92%",
          end: "top 28%",
          onUpdate: (self) =>
            setSky([0, 1, 2].map((k) => gsap.utils.interpolate(prev[k], c.sky[k], self.progress) as string)),
          onLeaveBack: () => setSky(prev),
          onLeave: () => setSky(c.sky),
        });
      });
      // stars fade in from dusk onwards
      ScrollTrigger.create({
        trigger: "#realms",
        start: "top 90%",
        end: "top 20%",
        onUpdate: (s) => gsap.set(stars, { opacity: s.progress }),
        onLeaveBack: () => gsap.set(stars, { opacity: 0 }),
      });
      gsap.set(stars, { opacity: 0 });

      /* ── chapter label + bookmark ribbon ── */
      const label = one(".st-chapter-label") as HTMLElement;
      const showChapter = (i: number) => {
        const c = CHAPTERS[Math.max(0, i)];
        gsap.fromTo(label, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", overwrite: true });
        label.innerHTML = `<b>${c.n}</b><i>${c.t.replace("'", "’")}</i>`;
      };
      CHAPTERS.forEach((c, i) => {
        if (i === 0) return;
        ScrollTrigger.create({
          trigger: `#${c.id}`,
          start: "top 55%",
          end: "max",
          onEnter: () => showChapter(i),
          onLeaveBack: () => showChapter(i - 1),
        });
      });
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (s) => gsap.set(".st-ribbon-fill", { scaleY: s.progress }),
      });
      };

      /* ── hero: layered mountains ── */
      const hero = one("#hero") as HTMLElement;
      const layers = q("#hero .sb-layer") as HTMLElement[];
      const far = layers.length;
      layers.forEach((l, i) => {
        const k = 0.5 - i * (0.5 / (far - 1)); // far layers drift down most → feel distant
        gsap.to(l, {
          y: () => vh * k,
          ease: "none",
          scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
        });
      });
      gsap.to(".st-sun", { y: vh * 0.55, scale: 1.25, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".st-hero-copy", { y: -90, opacity: 0.0, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "70% top", scrub: true } });

      // pointer parallax (x only — scroll owns y)
      const movers = layers.map((l, i) => gsap.quickTo(l, "x", { duration: 1.1, ease: "power3.out" }));
      const onMove = (e: PointerEvent) => {
        const nx = e.clientX / vw - 0.5;
        movers.forEach((mv, i) => mv(-nx * (i + 1) * 9));
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // drifting clouds + birds
      q(".st-cloud").forEach((c, i) => {
        gsap.to(c, { x: (i % 2 ? -1 : 1) * (120 + i * 30), duration: 34 + i * 7, ease: "sine.inOut", repeat: -1, yoyo: true });
      });
      q(".st-bird-wrap").forEach((b, i) => {
        gsap.fromTo(b, { x: -160 }, { x: vw + 160, duration: 26 + i * 6, ease: "none", repeat: -1, delay: i * 5 });
        gsap.to(b.querySelector("svg"), { y: -14, duration: 1.4 + i * 0.3, ease: "sine.inOut", repeat: -1, yoyo: true });
      });

      /* ── intro: the book opens, the world wakes ── */
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const intro = one(".st-intro") as HTMLElement | undefined;
      const lenis = window.__sbLenis;
      const wake = () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(".st-nav", { y: -40, opacity: 0, duration: 1 }, 0.2)
          .from(layers.map((l) => l.firstElementChild), { y: (i) => 160 + i * 50, opacity: 0, duration: 1.8, stagger: 0.12, ease: "power2.out" }, 0)
          .from(".st-sun span", { y: 140, opacity: 0, duration: 2.2, ease: "power2.out" }, 0.2)
          .from("#hero .st-hero-eyebrow", { opacity: 0, y: 14, duration: 1 }, 0.9)
          .from("#hero .st-title .st-c", { yPercent: 118, rotate: 9, duration: 1.2, stagger: 0.07 }, 0.9)
          .from("#hero .st-underline path", { strokeDashoffset: 600, duration: 1.4, ease: "power2.inOut" }, 1.7)
          .from("#hero .st-tag", { opacity: 0, y: 18, duration: 1 }, 1.5)
          .from("#hero .st-lede", { opacity: 0, y: 18, duration: 1 }, 1.7)
          .from("#hero .st-cta", { opacity: 0, y: 18, duration: 1 }, 1.9)
          .from("#login", { opacity: 0, x: 60, rotate: 2, duration: 1.4 }, 1.3)
          .from(".st-chapter, .st-ribbon", { opacity: 0, duration: 1 }, 2);
      };
      if (calm) {
        // no cover, no entrance, no ambient loops — the scroll-driven scenes still work, driven by the reader
        if (intro) intro.style.display = "none";
        introDone.current = true;
      } else if (intro && !introDone.current) {
        lenis?.stop();
        document.documentElement.style.overflow = "hidden";
        const done = () => {
          introDone.current = true;
          intro.style.display = "none";
          document.documentElement.style.overflow = "";
          lenis?.start();
          ScrollTrigger.refresh();
        };
        const tl = gsap.timeline({ onComplete: done });
        tl.from(".st-intro-seal", { scale: 0.5, opacity: 0, rotate: -40, duration: 1.1, ease: "back.out(1.6)" })
          .from(".st-intro-line", { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.14, ease: "power3.out" }, 0.4)
          .to(".st-intro-seal", { rotate: 360, duration: 1.4, ease: "power2.inOut" }, 1.2)
          .to(".st-intro-content", { opacity: 0, scale: 1.12, duration: 0.7, ease: "power2.in" }, 2.1)
          .to(".st-intro-l", { rotationY: -108, duration: 1.7, ease: "power3.inOut" }, 2.5)
          .to(".st-intro-r", { rotationY: 108, duration: 1.7, ease: "power3.inOut" }, 2.5)
          .to(".st-intro-shade", { opacity: 0, duration: 1.4 }, 2.6)
          .add(wake, 2.7);
        // fail-safe: never trap the visitor behind the cover
        window.setTimeout(() => {
          if (!introDone.current) {
            tl.progress(1);
          }
        }, 9000);
      } else {
        if (intro) intro.style.display = "none";
        wake();
      }

      /* ── prologue: ink soaks into the words as you scroll ── */
      const words = q(".st-pw") as HTMLElement[];
      gsap.from("#prologue .st-heading .st-c", {
        yPercent: 118,
        rotate: 6,
        duration: 1,
        stagger: 0.03,
        ease: "power3.out",
        scrollTrigger: { trigger: "#prologue", start: "top 70%" },
      });
      const pro = gsap.timeline({
        scrollTrigger: { trigger: "#prologue", start: "top top", end: "+=190%", pin: true, scrub: 0.6 },
      });
      pro
        .fromTo(words, { opacity: 0.1, filter: "blur(4px)" }, { opacity: 1, filter: "blur(0px)", stagger: 0.8 / words.length, duration: 0.14, ease: "none" }, 0.04)
        .to(".st-seal", { rotation: 540, ease: "none", duration: 1 }, 0)
        .fromTo(".st-leaf", { y: 120 }, { y: -160, ease: "none", stagger: 0.04, duration: 1 }, 0)
        .fromTo(".st-pro-fig", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, 0.55);

      /* ── gate: dive through the arch ── */
      const gate = one("#gate") as HTMLElement;
      const gl = {
        bg: one(".gt-bg") as HTMLElement,
        mid: one(".gt-mid") as HTMLElement,
        arch: one(".gt-arch") as HTMLElement,
        fore: one(".gt-fore") as HTMLElement,
      };
      const sc = Math.max(vw / 1600, vh / 900);
      const oy = vh / 2 + (590 - 450) * sc; // portal centre in px, matches the 1600×900 art
      Object.values(gl).forEach((el) => gsap.set(el, { transformOrigin: `50% ${oy}px` }));
      gsap.set(".gt-flash", { background: `radial-gradient(circle at 50% ${oy}px, #fffdea 0%, #ffeaa6 22%, #f8e3a8 62%, #f8e3a8 100%)` });
      gsap
        .timeline({ scrollTrigger: { trigger: gate, start: "top top", end: "+=280%", pin: true, scrub: 0.8 } })
        .fromTo(gl.bg, { scale: 1 }, { scale: 2.4, ease: "none", duration: 1 }, 0)
        .fromTo(gl.mid, { scale: 1 }, { scale: 6, ease: "none", duration: 1 }, 0)
        .fromTo(gl.arch, { scale: 1 }, { scale: 11, ease: "power2.in", duration: 1 }, 0)
        .fromTo(gl.fore, { scale: 1 }, { scale: 9, ease: "none", duration: 1 }, 0)
        .to(gl.fore, { opacity: 0, duration: 0.28 }, 0.3)
        .to(gl.mid, { opacity: 0, duration: 0.25 }, 0.58)
        .to(".gt-t1", { opacity: 0, y: -50, duration: 0.18 }, 0.1)
        .fromTo(".gt-t2", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.22 }, 0.52)
        .to(".gt-flash", { opacity: 1, duration: 0.3 }, 0.72)
        .to(".gt-t2", { opacity: 0, duration: 0.12 }, 0.9)
        .to(".st-swirl", { rotation: 900, ease: "none", duration: 1, svgOrigin: "800 600" }, 0)
        .to(".st-rune", { scale: 1.5, duration: 0.5, yoyo: true, repeat: 1 }, 0.1);

      /* ── road: a little bear walks across the land ── */
      const s = vh / 900;
      const T = Math.round(vw * 4.6);
      const charH = vh * 0.27;
      const charW = (charH * 170) / 230;
      const charX = vw * 0.3;
      const char = one(".rd-char") as HTMLElement;
      const strips = (["far", "mid", "road", "fore", "cloud"] as const).map((k) => ({ k, el: one(`.rd-${k}`) as HTMLElement, f: { far: 0.12, mid: 0.34, road: 1, fore: 1.38, cloud: 0.06 }[k] }));
      const signEls = q(".rd-sign") as HTMLElement[];
      const signX = [0.12, 0.3, 0.5, 0.7, 0.9].map((f) => charX + f * T);
      signEls.forEach((el, i) => {
        gsap.set(el, { x: signX[i], y: roadY(signX[i] / s) * s });
      });
      const legB = one(".br-leg-b"), legF = one(".br-leg-f"), arm = one(".br-arm"), scarf = one(".br-scarf");
      const place = (p: number) => {
        strips.forEach(({ el, f }) => gsap.set(el, { x: -p * f * T }));
        const wx = (charX + p * T) / s;
        const fy = roadY(wx) * s;
        const slope = (roadY(wx + 6) - roadY(wx - 6)) / 12;
        const ph = (p * T) / 70;
        const swing = Math.sin(ph);
        gsap.set(char, { x: charX - charW / 2, y: fy - charH + charH * 0.04 - Math.abs(swing) * 5, rotation: Math.atan(slope) * 28 });
        if (legB) gsap.set(legB, { rotation: swing * 26 });
        if (legF) gsap.set(legF, { rotation: -swing * 26 });
        if (arm) gsap.set(arm, { rotation: swing * -9 });
        if (scarf) gsap.set(scarf, { rotation: Math.sin(ph * 0.5 + 1) * 9 });
        signEls.forEach((el, i) => {
          const sx = signX[i] - p * T;
          el.style.setProperty("--n", clamp(1 - Math.abs(sx - vw * 0.52) / (vw * 0.3)).toFixed(3));
        });
        gsap.set(".rd-progress-dot", { left: `${p * 100}%` });
      };
      gsap.set(char, { width: charW, height: charH });
      place(0);
      ScrollTrigger.create({
        trigger: "#road",
        start: "top top",
        end: () => `+=${Math.round(T * 0.8)}`,
        pin: true,
        onUpdate: (self) => place(self.progress),
        onRefresh: (self) => place(self.progress),
      });
      gsap.from("#road .rd-title .st-c", { yPercent: 118, duration: 1, stagger: 0.03, ease: "power3.out", scrollTrigger: { trigger: "#road", start: "top 60%" } });
      q(".rd-butterfly").forEach((b, i) => {
        gsap.to(b, { x: `+=${60 + i * 30}`, y: `-=${40 + i * 14}`, duration: 3.4 + i, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });

      /* ── voices: the ticker reacts to your scroll speed ── */
      const tracks = q(".vo-track") as HTMLElement[];
      const base = tracks.map((_, i) => (i % 2 ? -1 : 1));
      const tweens = tracks.map((tr, i) =>
        gsap.fromTo(tr, { xPercent: base[i] > 0 ? 0 : -50 }, { xPercent: base[i] > 0 ? -50 : 0, ease: "none", duration: 46 - i * 8, repeat: -1 }),
      );
      ScrollTrigger.create({
        trigger: "#voices",
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 260, 7);
          const dir = self.direction;
          tweens.forEach((tw, i) => {
            gsap.timeline({ overwrite: true }).to(tw, { timeScale: base[i] * dir * boost, duration: 0.25 }).to(tw, { timeScale: base[i], duration: 1.2 });
          });
        },
      });
      gsap.to(".vo-sun", { rotation: 220, ease: "none", scrollTrigger: { trigger: "#voices", start: "top bottom", end: "bottom top", scrub: true } });
      gsap.fromTo(".vo-band-a", { rotation: -7, y: 90 }, { rotation: -3, y: 0, ease: "none", scrollTrigger: { trigger: "#voices", start: "top bottom", end: "center center", scrub: true } });
      gsap.fromTo(".vo-band-b", { rotation: 6, y: -90 }, { rotation: 2, y: 0, ease: "none", scrollTrigger: { trigger: "#voices", start: "top bottom", end: "center center", scrub: true } });
      gsap.from("#voices .st-heading .st-c", { yPercent: 118, duration: 1, stagger: 0.03, ease: "power3.out", scrollTrigger: { trigger: "#voices", start: "top 60%" } });

      /* ── realms: a 3-D spiral staircase of storybook pages ── */
      const cards = q(".sp-card") as HTMLElement[];
      const dots = q(".sp-dot") as HTMLElement[];
      const n = cards.length;
      const step = 64; // degrees between consecutive pages
      const R = Math.min(640, vw * 0.34);
      const gap = Math.min(120, vh * 0.13);
      const total = (n - 1) * step;
      const H = (n - 1) * gap;
      const nd = dots.length;
      const paint = (p: number) => {
        cards.forEach((c, i) => {
          const rel = ((((i * step - p * total) % 360) + 540) % 360) - 180;
          const a = Math.abs(rel);
          gsap.set(c, {
            rotationY: i * step - p * total,
            y: i * gap - p * H,
            transformOrigin: `50% 50% ${-R}px`,
            opacity: a > 100 ? 0 : clamp(1.15 - a / 95),
            zIndex: Math.round(1000 - a),
            pointerEvents: a < 22 ? "auto" : "none",
          });
        });
        dots.forEach((d, j) => {
          const t = j / (nd - 1);
          const rel = ((((t * total - p * total) % 360) + 540) % 360) - 180;
          const a = Math.abs(rel);
          gsap.set(d, {
            rotationY: t * total - p * total,
            y: t * H - p * H + 210,
            transformOrigin: `50% 50% ${-R * 1.04}px`,
            opacity: a > 100 ? 0.15 : 0.95 - a / 160,
            scale: a > 100 ? 0.5 : 1.2 - a / 220,
          });
        });
        setRealmStable(clamp(Math.round(p * (n - 1)), 0, n - 1));
      };
      paint(0);
      ScrollTrigger.create({
        trigger: "#realms",
        start: "top top",
        end: `+=${n * 85}%`,
        pin: true,
        scrub: true,
        onUpdate: (self) => paint(self.progress),
        onRefresh: (self) => paint(self.progress),
      });
      gsap.from("#realms .st-heading .st-c", { yPercent: 118, duration: 1, stagger: 0.03, ease: "power3.out", scrollTrigger: { trigger: "#realms", start: "top 60%" } });

      /* ── wheel: the year turns beneath you ── */
      const outer = one(".wh-outer") as HTMLElement;
      const inner = one(".st-wheel-inner") as SVGGElement | undefined;
      const turn = gsap.timeline({
        scrollTrigger: {
          trigger: "#wheel",
          start: "top top",
          end: "+=420%",
          pin: true,
          scrub: 0.7,
          onUpdate: (self) => setMonthStable(clamp(span.first + Math.round(self.progress * (span.last - span.first)), 0, 11)),
        },
      });
      turn.fromTo(outer, { rotation: -span.first * 30 }, { rotation: -span.last * 30, ease: "none", duration: 1 }, 0);
      if (inner) turn.fromTo(inner, { rotation: 0, svgOrigin: "0 0" }, { rotation: 300, ease: "none", duration: 1, svgOrigin: "0 0" }, 0);
      gsap.from("#wheel .st-heading .st-c", { yPercent: 118, duration: 1, stagger: 0.03, ease: "power3.out", scrollTrigger: { trigger: "#wheel", start: "top 60%" } });

      /* ── finale ── */
      gsap.from("#finale .fn-reveal", { y: 60, opacity: 0, duration: 1.3, stagger: 0.16, ease: "power3.out", scrollTrigger: { trigger: "#finale", start: "top 55%" } });
      gsap.from("#finale .fn-title .st-c", { yPercent: 118, rotate: 6, duration: 1.1, stagger: 0.03, ease: "power3.out", scrollTrigger: { trigger: "#finale", start: "top 50%" } });
      const counters = q(".fn-num") as HTMLElement[];
      counters.forEach((el) => {
        const end = parseInt(el.dataset.v || "0", 10);
        const plus = el.dataset.plus === "1";
        const o = { v: 0 };
        gsap.to(o, {
          v: end,
          duration: 2.2,
          ease: "power3.out",
          onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString("en-IN") + (plus ? "+" : "")),
          scrollTrigger: { trigger: el, start: "top 90%" },
        });
      });
      q(".fn-fly").forEach((f, i) => {
        gsap.set(f, { x: gsap.utils.random(0, vw), y: gsap.utils.random(vh * 0.2, vh * 0.9) });
        const roam = () =>
          gsap.to(f, { x: `+=${gsap.utils.random(-220, 220)}`, y: `+=${gsap.utils.random(-120, 120)}`, duration: gsap.utils.random(3, 6), ease: "sine.inOut", onComplete: roam });
        roam();
        gsap.to(f, { opacity: gsap.utils.random(0.25, 1), duration: gsap.utils.random(0.8, 2), repeat: -1, yoyo: true, delay: i * 0.1 });
      });
      const glowX = gsap.quickTo(".fn-glow", "x", { duration: 0.8, ease: "power3.out" });
      const glowY = gsap.quickTo(".fn-glow", "y", { duration: 0.8, ease: "power3.out" });
      const finale = one("#finale") as HTMLElement;
      const onGlow = (e: PointerEvent) => {
        glowX(e.clientX);
        glowY(e.clientY - finale.getBoundingClientRect().top);
      };
      window.addEventListener("pointermove", onGlow, { passive: true });

      // reduced motion: park every endless ambient loop (clouds, birds, ticker, fireflies)
      if (calm) {
        gsap.globalTimeline.getChildren(true, true, false).forEach((tw) => {
          if (tw.repeat() === -1) tw.pause();
        });
      }

      // created last so they measure AFTER every pin spacer above them exists
      globalTriggers();

      // fonts change glyph widths → re-measure the pins once they land
      document.fonts?.ready.then(() => ScrollTrigger.refresh());

      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointermove", onGlow);
      };
    }, root);
    return () => ctx.revert();
  }, [dims, span, setRealmStable, setMonthStable]);

  /* ─────────────────────────────── render ─────────────────────────────── */
  const stat = [
    { v: Math.floor(data.places / 100) * 100, plus: 1, l: "Places curated" },
    { v: data.states.length, plus: 0, l: "States covered" },
    { v: data.festivalCount, plus: 0, l: "Festivals tracked" },
    { v: data.categories.length, plus: 0, l: "Realms of travel" },
  ].filter((x) => x.v > 0); // never advertise a zero if the catalogue query came back empty
  const w = dims?.vw ?? 1440;
  const h = dims?.vh ?? 900;
  const s = h / 900;
  const T = Math.round(w * 4.6);
  const unitsFor = (f: number) => Math.round((w + f * T) / s);

  const stateStrip = [...states, ...states];
  const ticker1 = (
    <>
      {stateStrip.map((st, i) => (
        <span className="vo-item" key={i}>
          {st}
          <em>✦</em>
        </span>
      ))}
    </>
  );
  const phrases = ["Plan", "Wander", "Wonder", "Return", "Plan", "Wander", "Wonder", "Return"];
  const ticker2 = (
    <>
      {[...phrases, ...phrases].map((p, i) => (
        <span className="vo-item vo-outline" key={i}>
          {p}
          <em>❋</em>
        </span>
      ))}
    </>
  );

  return (
    <div ref={root} className="story">
      {/* the one painting behind everything */}
      <div className="st-sky" aria-hidden />
      <div className="st-stars" aria-hidden>
        {Array.from({ length: 90 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 137.5) % 100}%`, top: `${(i * 61.8) % 70}%`, animationDelay: `${(i % 9) * 0.35}s`, width: i % 7 === 0 ? 3 : 2, height: i % 7 === 0 ? 3 : 2 }} />
        ))}
      </div>

      {/* opening the book */}
      <div className="st-intro" aria-hidden>
        <div className="st-intro-l st-intro-cover" />
        <div className="st-intro-r st-intro-cover" />
        <div className="st-intro-shade" />
        <div className="st-intro-content">
          <div className="st-intro-seal">
            <LogoMark className="h-24 w-24" />
          </div>
          <div className="st-intro-mask">
            <p className="st-intro-line st-intro-title">Saafera</p>
          </div>
          <div className="st-intro-mask">
            <p className="st-intro-line st-intro-sub">a storybook map of India</p>
          </div>
        </div>
      </div>

      {/* chrome */}
      <header className="st-nav">
        <button type="button" className="st-brand" onClick={() => goTo(0)} aria-label="Back to the first page">
          <LogoMark className="h-9 w-9" />
          <span>Saafera</span>
        </button>
        <div className="st-nav-r">
          <button type="button" className="st-toc-btn" onClick={() => setToc(true)}>
            <span>Chapters</span>
            <i aria-hidden />
          </button>
          <Link href="/admin-login" className="st-admin">
            Admin
          </Link>
        </div>
      </header>
      <div className={`st-toc ${toc ? "is-open" : ""}`} onClick={() => setToc(false)} role="dialog" aria-label="Table of contents">
        <div className="st-toc-page" onClick={(e) => e.stopPropagation()}>
          <h2>Contents</h2>
          <ol>
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setToc(false);
                    window.setTimeout(() => goTo(`#${c.id}`), 250);
                  }}
                >
                  <b>{c.n}</b>
                  <span>{c.t}</span>
                  <u aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="st-chapter" aria-hidden>
        <span className="st-chapter-label">
          <b>I</b>
          <i>The Waking Mountains</i>
        </span>
      </div>
      <div className="st-ribbon" aria-hidden>
        <span className="st-ribbon-fill" />
      </div>

      {/* ═══ I · HERO ═══ */}
      <section id="hero" className="st-hero">
        <div className="st-hero-art" aria-hidden>
          <div className="st-sun">
            <span />
          </div>
          <div className="st-cloud" style={{ left: "6%", top: "15%" }}>
            <Cloud w={360} seed={2} />
          </div>
          <div className="st-cloud" style={{ left: "46%", top: "9%", opacity: 0.85 }}>
            <Cloud w={300} seed={5} />
          </div>
          <div className="st-cloud" style={{ left: "70%", top: "24%", opacity: 0.8 }}>
            <Cloud w={420} seed={8} />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="st-bird-wrap" style={{ top: `${14 + i * 7}%` }}>
              <Bird s={1 - i * 0.18} />
            </div>
          ))}
          <MountainScape layers={DAWN_LAYERS} idPrefix="hero" seed={4} />
        </div>

        <div className="st-hero-grid">
          <div className="st-hero-copy">
            <p className="st-hero-eyebrow sb-eyebrow">Chapter I · The Waking Mountains</p>
            <h1 className="st-title">
              <Chars text="Saafera" />
            </h1>
            <svg className="st-underline" viewBox="0 0 520 26" aria-hidden>
              <path d="M6 16C90 4 180 24 260 13S430 6 514 14" fill="none" stroke="#d98a3d" strokeWidth="7" strokeLinecap="round" strokeDasharray="600" />
            </svg>
            <p className="st-tag">Explore More. Fulfill Soul.</p>
            <p className="st-lede">
              From temple bells in the mist to waterfalls that hide whole villages — a hand-drawn map of India, made to fit the coins in your pocket.
            </p>
            <div className="st-cta">
              <button type="button" className="btn-primary px-6 py-3 text-base" onClick={() => goTo("#prologue")}>
                Begin the tale
              </button>
              <span className="st-scroll-hint">turn the page ↓</span>
            </div>
          </div>
          <div id="login" className="st-login">
            {auth}
          </div>
        </div>
      </section>

      {/* ═══ II · PROLOGUE ═══ */}
      <section id="prologue" className="st-prologue">
        <div className="st-leaves" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="st-leaf" style={{ left: `${8 + i * 10.5}%`, top: `${20 + ((i * 37) % 60)}%`, transform: `rotate(${i * 41}deg) scale(${0.7 + (i % 3) * 0.3})` }} />
          ))}
        </div>
        <div className="st-pro-inner">
          <div className="st-seal-wrap" aria-hidden>
            <svg className="st-seal" viewBox="-100 -100 200 200">
              <g filter="url(#sb-rough)" fill="none" stroke="#b6702f" strokeWidth="2.4">
                <circle r="92" />
                <circle r="70" strokeDasharray="3 7" />
                {Array.from({ length: 16 }, (_, i) => (
                  <path key={i} d="M0 -70L7 -52L0 -34L-7 -52Z" fill="#e5a850" stroke="#b6702f" transform={`rotate(${i * 22.5})`} />
                ))}
                <circle r="26" fill="#f6d78a" />
                <path d="M-14 4q14 -22 28 0" strokeWidth="3.4" />
              </g>
            </svg>
            <div className="st-pro-fig">
              <Cottage />
            </div>
          </div>
          <div className="st-pro-text">
            <h2 className="st-heading">
              <Chars text="Prologue" />
            </h2>
            <p className="st-prose">
              <Words
                cls="st-pw"
                text="Long before the roads had names, India was a storybook no one had finished reading. Somewhere a temple bell was still ringing through the mist. Somewhere a waterfall hid a village, and a festival lit a thousand lamps for no one in particular. Saafera is the map that remembers them all — and a lantern to carry you there, within the coins in your pocket."
              />
            </p>
          </div>
        </div>
      </section>

      {/* ═══ III · GATE ═══ */}
      <section id="gate" className="st-gate">
        <div className="gt-layer gt-bg">
          <GateBackdrop />
        </div>
        <div className="gt-layer gt-mid">
          <GateMid />
        </div>
        <div className="gt-layer gt-arch">
          <GateArch />
        </div>
        <div className="gt-layer gt-fore">
          <GateFore />
        </div>
        <div className="gt-flash" />
        <div className="gt-t1">
          <p className="sb-eyebrow">Chapter III · The Gate</p>
          <h2>Every journey begins with a door.</h2>
        </div>
        <div className="gt-t2">
          <h2>Step through.</h2>
        </div>
      </section>

      {/* ═══ IV · ROAD ═══ */}
      <section id="road" className="st-road">
        <div className="rd-top">
          <p className="sb-eyebrow">Chapter IV · The Wanderer&rsquo;s Road</p>
          <h2 className="rd-title st-heading">
            <Chars text="One little traveller, five good reasons" />
          </h2>
        </div>
        {dims && (
          <>
            <div className="rd-sunball" aria-hidden />
            <div className="rd-strip rd-cloud" style={{ width: Math.round(w + 0.06 * T) }} aria-hidden>
              {[8, 30, 52, 74].map((p, i) => (
                <div key={i} className="rd-cl" style={{ left: `${p}%`, top: `${8 + (i % 2) * 11}%` }}>
                  <Cloud w={280 + i * 40} seed={20 + i} tint="#ffffff" shade="#d9e8f0" />
                </div>
              ))}
            </div>
            <div className="rd-strip rd-far" style={{ width: Math.round(w + 0.12 * T) }} aria-hidden>
              <WideRidges
                widthUnits={unitsFor(0.12)}
                seed={31}
                idp="rf"
                layers={[
                  { color: "#b9d3d8", fade: "#e3eadb", shade: "#9fbdc6", base: 600, amp: 260, peaksPer1600: 3 },
                  { color: "#9fc3b9", fade: "#d6e6c9", shade: "#80ab9f", base: 660, amp: 200, peaksPer1600: 4 },
                ]}
              />
            </div>
            <div className="rd-strip rd-mid" style={{ width: Math.round(w + 0.34 * T) }} aria-hidden>
              <WideRidges
                widthUnits={unitsFor(0.34)}
                seed={44}
                idp="rm"
                layers={[
                  { color: "#86b98a", fade: "#bfd89a", shade: "#6c9f72", base: 690, amp: 130, peaksPer1600: 5, trees: "pine", treeColor: "#4f8a5c", treeDensity: 36 },
                  { color: "#6aa56c", fade: "#a8cc82", shade: "#528a58", base: 770, amp: 90, peaksPer1600: 6, trees: "oak", treeColor: "#4e8d4b", treeDensity: 26 },
                ]}
              />
            </div>
            <div className="rd-strip rd-road" style={{ width: Math.round(w + T) }}>
              <RoadStrip widthUnits={unitsFor(1)} />
              {SIGNS.map((sg, i) => (
                <div className="rd-sign" key={sg.t}>
                  <div className="rd-board">
                    <span className="rd-no">{["I", "II", "III", "IV", "V"][i]}</span>
                    <h3>{sg.t}</h3>
                    <p>{sg.d}</p>
                  </div>
                  <i className="rd-post" />
                </div>
              ))}
            </div>
            <div className="rd-char" aria-hidden>
              <Bear />
              <span className="rd-butterfly" style={{ left: "70%", top: "0%" }}>
                🦋
              </span>
              <span className="rd-butterfly" style={{ left: "-20%", top: "20%" }}>
                🦋
              </span>
            </div>
            <div className="rd-strip rd-fore" style={{ width: Math.round(w + 1.38 * T) }} aria-hidden>
              <svg viewBox={`0 0 ${unitsFor(1.38)} 900`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                <g filter="url(#sb-wash)">
                  <path
                    d={(() => {
                      const W = unitsFor(1.38);
                      let d = `M0 910V860`;
                      for (let x = 0; x <= W; x += 46) d += `L${x} ${(852 + 18 * Math.sin(x / 90) + (x % 3) * 6).toFixed(0)}L${x + 22} ${(826 - ((x / 46) % 4) * 8).toFixed(0)}`;
                      return d + `L${W} 910Z`;
                    })()}
                    fill="#2f5f3a"
                  />
                </g>
              </svg>
            </div>
            <div className="rd-progress" aria-hidden>
              <span className="rd-progress-dot" />
            </div>
          </>
        )}
      </section>

      {/* ═══ V · VOICES / TICKER ═══ */}
      <section id="voices" className="st-voices">
        <div className="vo-sun" aria-hidden>
          <svg viewBox="-300 -300 600 600">
            <g filter="url(#sb-rough)">
              {Array.from({ length: 28 }, (_, i) => (
                <path key={i} d="M-14 -190L0 -290L14 -190Z" fill={i % 2 ? "#ffd48a" : "#ffb36b"} opacity="0.75" transform={`rotate(${i * (360 / 28)})`} />
              ))}
              <circle r="170" fill="#ffe3a8" opacity="0.9" />
              <circle r="120" fill="#ffd27d" />
            </g>
          </svg>
        </div>
        <div className="vo-head">
          <p className="sb-eyebrow">Chapter V · Names the Wind Whispers</p>
          <h2 className="st-heading">
            <Chars text="Every land has a name worth saying twice" />
          </h2>
        </div>
        <div className="vo-bands">
          <div className="vo-band vo-band-a">
            <div className="vo-track">{ticker1}</div>
          </div>
          <div className="vo-band vo-band-b">
            <div className="vo-track">{ticker2}</div>
          </div>
        </div>
        <MountainScape layers={DUSK_LAYERS} idPrefix="dusk" seed={9} className="vo-scape" />
      </section>

      {/* ═══ VI · REALMS (3-D SPIRAL) ═══ */}
      <section id="realms" className="st-realms">
        <div className="sp-copy">
          <p className="sb-eyebrow">Chapter VI · The Six Realms</p>
          <h2 className="st-heading">
            <Chars text="Six realms, one lantern" />
          </h2>
          <div className="sp-now" key={realm}>
            <span className="sp-now-n">{["I", "II", "III", "IV", "V", "VI"][realm]}</span>
            <h3>{data.categories[realm]?.label}</h3>
            <p>{BLURB[data.categories[realm]?.slug] ?? ""}</p>
          </div>
          <p className="sp-hint">scroll to climb the spiral</p>
        </div>
        <div className="sp-stage">
          {Array.from({ length: 46 }, (_, i) => (
            <i key={i} className="sp-dot" />
          ))}
          {data.categories.map((c, i) => (
            <article className="sp-card" key={c.slug}>
              <div className="sp-art">
                <RealmArt kind={c.slug as RealmKind} />
                <span className="sp-emoji">{c.emoji}</span>
              </div>
              <div className="sp-body">
                <small>Realm {["I", "II", "III", "IV", "V", "VI"][i]}</small>
                <h3>{c.label}</h3>
                <p>{BLURB[c.slug]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ═══ VII · WHEEL ═══ */}
      <section id="wheel" className="st-wheel">
        <div className="wh-copy">
          <p className="sb-eyebrow">Chapter VII · The Wheel of Festivals</p>
          <h2 className="st-heading">
            <Chars text="The year turns, the lamps follow" />
          </h2>
          <div className="wh-now" key={month}>
            <span className="wh-month">{MONTHS[month]}</span>
            {byMonth[month].length ? (
              <ul>
                {byMonth[month].slice(0, 4).map((f) => (
                  <li key={f.name}>
                    <b>{f.emoji}</b>
                    <span>{f.name}</span>
                    <em>{f.dateLabel}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wh-quiet">A quiet month — the road is all yours.</p>
            )}
          </div>
        </div>
        <div className="wh-pointer" aria-hidden />
        <div className="wh-outer" style={{ ["--D" as string]: `${Math.round(Math.min(w * 1.08, h * 1.7))}px` }}>
          <FestivalWheel emojiByMonth={emojiByMonth} />
        </div>
      </section>

      {/* ═══ VIII · FINALE ═══ */}
      <section id="finale" className="st-finale">
        <div className="fn-glow" aria-hidden />
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} className="fn-fly" aria-hidden />
        ))}
        <div className="fn-inner">
          <p className="sb-eyebrow fn-reveal">Chapter VIII · Epilogue</p>
          <h2 className="fn-title">
            <Chars text="Your story is waiting" />
          </h2>
          <p className="fn-lede fn-reveal">The lantern is lit and the road is drawn. All that is missing is you.</p>
          <div className="fn-stats fn-reveal">
            {stat.map((x) => (
              <div key={x.l}>
                <b className="fn-num" data-v={x.v} data-plus={x.plus}>
                  0
                </b>
                <span>{x.l}</span>
              </div>
            ))}
          </div>
          <div className="fn-reveal">
            <button
              type="button"
              className="btn-primary px-8 py-4 text-lg"
              onClick={() => {
                goTo(0);
                window.setTimeout(() => (document.querySelector("#login input") as HTMLInputElement | null)?.focus({ preventScroll: true }), 2400);
              }}
            >
              Begin your journey
            </button>
          </div>
        </div>
        <div className="fn-scape" aria-hidden>
          <MountainScape layers={NIGHT_LAYERS} idPrefix="night" seed={12} />
          <div className="fn-cottage">
            <Cottage />
          </div>
        </div>
        <footer className="fn-foot">
          <nav>
            <Link href="/about">About</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <span>© Saafera — Explore More. Fulfill Soul.</span>
        </footer>
      </section>
    </div>
  );
}

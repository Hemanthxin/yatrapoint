"use client";

import "./quest.css";
import "@/components/app/journey/journey.css"; // shared blink / wing-beat / hover keyframes for the cast
import { useEffect, useRef, useState } from "react";
import { MountainScape, type ScapeLayer } from "@/components/storybook/MountainScape";
import { Bear } from "@/components/story/scenes";
import { Fox, Owl } from "@/components/app/journey/characters";

export const CHAPTERS = [
  { title: "The Map Room", where: "Where does the road begin?" },
  { title: "The Packing Table", where: "What shall we gather along the way?" },
  { title: "The Road Ahead", where: "How do we travel, and what do we eat?" },
  { title: "The Oath", where: "Seal the plan and set off." },
] as const;
const ROMAN = ["I", "II", "III", "IV"];
const NAMES = ["Teddy", "Juno", "Pip"] as const;

// Short banner crops the 1600×900 art from the bottom, so ridges sit low.
const RIDGES: ScapeLayer[] = [
  { color: "#dcc4f2", fade: "#ffe6cc", shade: "#bb98e0", base: 730, amp: 220, peaks: 5, snow: true },
  { color: "#9fc0f2", fade: "#e4eed8", shade: "#7da2e0", base: 790, amp: 170, peaks: 6 },
  { color: "#4fc08a", fade: "#c4ecaa", shade: "#2f9f6c", base: 860, amp: 120, peaks: 8, trees: "pine", treeColor: "#2a9a66", treeCount: 60, treeSize: [24, 46] },
];

/** A painted scene per chapter — the time of day advances as the trip is planned — with the three companions speaking. */
export function QuestGuide({ step, who, text }: { step: number; who: 0 | 1 | 2; text: string }) {
  const ch = CHAPTERS[Math.min(step, CHAPTERS.length - 1)];
  return (
    <section className="qg" data-step={step} aria-label={`Chapter ${ROMAN[step]}: ${ch.title}`}>
      <div className="qg-sky" aria-hidden>
        <span className="qg-sun" />
        <span className="qg-stars" />
      </div>
      <MountainScape layers={RIDGES} idPrefix="qg" seed={5} className="qg-ridges" />
      <div className="qg-dusk" aria-hidden />

      <div className="qg-title">
        <p className="sb-eyebrow">Chapter {ROMAN[step]}</p>
        <h2>{ch.title}</h2>
      </div>

      <div className="qg-cast" aria-hidden>
        <div className={`qg-c qg-juno ${who === 1 ? "is-talking" : ""}`}>
          <Fox />
        </div>
        <div className={`qg-c qg-teddy ${who === 0 ? "is-talking" : ""}`}>
          <Bear />
        </div>
        <div className={`qg-c qg-pip ${who === 2 ? "is-talking" : ""}`}>
          <div className="jr-hover">
            <Owl />
          </div>
        </div>
      </div>

      <div className="qg-say" key={`${who}-${text}`} role="status" aria-live="polite">
        <i>{NAMES[who]}</i>
        {text}
      </div>
    </section>
  );
}

/** The chapter trail: a winding path with a station per step and Teddy walking between them. */
export function QuestPath({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  const n = CHAPTERS.length;
  const X0 = 40;
  const X1 = 560;
  const yAt = (x: number) => 36 + 12 * Math.sin((x - X0) / 38);
  const xs = Array.from({ length: n }, (_, i) => X0 + (i * (X1 - X0)) / (n - 1));
  const d = Array.from({ length: 53 }, (_, k) => {
    const x = X0 + (k * (X1 - X0)) / 52;
    return `${k ? "L" : "M"}${x.toFixed(1)} ${yAt(x).toFixed(1)}`;
  }).join("");
  const pct = (step / (n - 1)) * 100;

  // Teddy walks (legs swing) for the second it takes to reach the next station.
  const [walking, setWalking] = useState(false);
  const prev = useRef(step);
  useEffect(() => {
    if (prev.current === step) return;
    prev.current = step;
    setWalking(true);
    const t = window.setTimeout(() => setWalking(false), 950);
    return () => window.clearTimeout(t);
  }, [step]);

  return (
    <nav className="qp" aria-label="Planner chapters">
      <div className="qp-track">
        <svg viewBox="0 0 600 72" preserveAspectRatio="none" aria-hidden>
          <path d={d} pathLength={100} className="qp-base" />
          <path d={d} pathLength={100} className="qp-done" style={{ strokeDasharray: 100, strokeDashoffset: 100 - pct }} />
        </svg>
        <div className={`qp-bear ${walking ? "is-walking" : ""}`} style={{ left: `${(xs[step] / 600) * 100}%`, top: `${(yAt(xs[step]) / 72) * 100}%` }} aria-hidden>
          <Bear />
        </div>
        {xs.map((x, i) => (
          <button
            key={CHAPTERS[i].title}
            type="button"
            disabled={i > step}
            onClick={() => onJump(i)}
            className={`qp-stop ${i === step ? "is-on" : ""} ${i < step ? "is-done" : ""}`}
            style={{ left: `${(x / 600) * 100}%`, top: `${(yAt(x) / 72) * 100}%` }}
            aria-current={i === step ? "step" : undefined}
          >
            <i>{i < step ? "✓" : ROMAN[i]}</i>
            <span>{CHAPTERS[i].title}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

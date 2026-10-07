"use client";

import "./quest.css";
import "@/components/app/journey/journey.css";
import { useEffect, useMemo, useState } from "react";
import { makeRidge, ridgeFill } from "@/components/storybook/paint";
import { Bear } from "@/components/story/scenes";
import { Fox, Owl } from "@/components/app/journey/characters";
import { formatINR } from "@/lib/format";

/** A ridge that tiles forever: the ridge, then its mirror image, so both ends meet at the same height. */
function PanRidge({ seed, base, amp, peaks, color, className }: { seed: number; base: number; amp: number; peaks: number; color: string; className: string }) {
  const d = useMemo(() => ridgeFill(makeRidge({ seed, base, amp, peaks, width: 800, step: 8, rough: 0.5 }).pts, 410), [seed, base, amp, peaks]);
  const tile = (
    <svg viewBox="0 0 1600 400" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill={color} />
      <path d={d} fill={color} transform="translate(1600 0) scale(-1 1)" />
    </svg>
  );
  return (
    <div className={`ql-pan ${className}`} aria-hidden>
      {tile}
      {tile}
    </div>
  );
}

/**
 * Shown while the plan is being built. The planner's real work (finding places,
 * routing, costing) takes a few seconds — this is the show that plays meanwhile.
 * The meter is honest about being an estimate: it eases toward ~92% and only the
 * arrival of the plan ends the scene.
 */
export function QuestLoader({ budget, people, days, stops }: { budget: number; people: number; days: number; stops: number }) {
  const lines = useMemo(
    () => [
      "Juno unrolls a fresh map of the countryside…",
      `Pip counts out your ${formatINR(budget)} — coin by coin…`,
      "Teddy sniffs the air for hidden waterfalls…",
      `Hunting for ${stops} wonderful stops for ${people} traveller${people === 1 ? "" : "s"}…`,
      "Measuring roads, fuel and chai breaks…",
      "Juno inks the final route in her best handwriting…",
      "Almost there — Teddy is lacing his boots!",
    ],
    [budget, people, stops],
  );
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(4);

  useEffect(() => {
    const a = window.setInterval(() => setPhase((p) => Math.min(lines.length - 1, p + 1)), 1900);
    const t0 = performance.now();
    const b = window.setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      setPct(Math.min(92, 4 + 88 * (1 - Math.exp(-t / 6))));
    }, 120);
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
    };
  }, [lines.length]);

  return (
    <section className="ql" role="status" aria-live="polite" aria-label="Building your plan">
      <div className="ql-scene">
        <div className="ql-sky" aria-hidden>
          <span className="ql-sun" />
        </div>
        <PanRidge className="ql-far" seed={31} base={300} amp={190} peaks={3} color="#c9d8f6" />
        <PanRidge className="ql-mid" seed={44} base={330} amp={120} peaks={4} color="#8fd6a8" />
        <PanRidge className="ql-near" seed={57} base={372} amp={60} peaks={6} color="#4fb878" />
        <div className="ql-road" aria-hidden />
        <div className="ql-cast q-walk" aria-hidden>
          <div className="ql-c ql-juno">
            <Fox />
          </div>
          <div className="ql-c ql-teddy">
            <Bear />
          </div>
          <div className="ql-c ql-pip">
            <div className="jr-hover">
              <Owl />
            </div>
          </div>
        </div>
      </div>

      <div className="ql-body">
        <p className="ql-line" key={phase}>
          {lines[phase]}
        </p>
        <div className="ql-meter" aria-hidden>
          <i style={{ width: `${pct}%` }} />
          <b style={{ left: `${pct}%` }}>🪙</b>
        </div>
        <ul className="ql-chips" aria-hidden>
          <li>💰 {formatINR(budget)}</li>
          <li>📅 {days} {days === 1 ? "day" : "days"}</li>
          <li>🧑‍🤝‍🧑 {people}</li>
          <li>📍 {stops} stops</li>
        </ul>
      </div>
    </section>
  );
}

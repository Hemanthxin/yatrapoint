"use client";

import "./quest.css";
import { Fragment } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { planStopHref } from "@/lib/place-href";
import { formatINR } from "@/lib/format";
import { DAY_NAMES, KIND_EMOJI, KIND_LABEL, assignDays, fmtKm, fmtMinutes, kindOf, teddyLine, type StoryStop } from "./story-text";

interface Totals {
  cost: number;
  perPersonCost: number;
  distanceKm: number;
  unspentBudget: number;
  fuelTotal: number;
  entryFeesTotal: number;
  foodTotal: number;
  stayTotal?: number;
}

const rise = {
  hidden: { opacity: 0, y: 36, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

/** The finished plan, told as a story: one chapter per stop, grouped by day, ending with Pip's ledger. */
export function TripStory({
  stops,
  totals,
  budget,
  people,
  days,
  hours,
  originLabel,
}: {
  stops: StoryStop[];
  totals: Totals;
  budget: number;
  people: number;
  days: number;
  hours: number;
  originLabel?: string;
}) {
  if (stops.length === 0) return null;
  const dayOf = assignDays(stops, Math.max(1, days), hours);
  const used = budget > 0 ? Math.min(100, Math.round((totals.cost / budget) * 100)) : 100;
  const over = totals.cost > budget;

  return (
    <section className="ts" aria-label="The tale of your trip">
      <header className="ts-head">
        <div className="ts-lanterns" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ left: `${6 + i * 11}%`, animationDelay: `${(i % 5) * 0.45}s` }} />
          ))}
        </div>
        <p className="ts-ta">Ta-da! Your adventure is ready</p>
        <h2>The tale of your trip</h2>
        <p className="ts-sub">
          {stops.length} {stops.length === 1 ? "chapter" : "chapters"} · {fmtKm(totals.distanceKm)} of road · {formatINR(totals.cost)} for {people} traveller{people === 1 ? "" : "s"}
        </p>
      </header>

      <ol className="ts-trail">
        <motion.li className="ts-node ts-start" variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6 }}>
          <span className="ts-dot">🎒</span>
          <div className="ts-card ts-card-wide">
            <small>Before the first step</small>
            <h3>{originLabel ? `The road begins at ${originLabel}` : "The road begins at your door"}</h3>
            <p>
              <b>🐻 Teddy</b> laces his boots, <b>🦊 Juno</b> unrolls the map and <b>🦉 Pip</b> checks the purse: {formatINR(budget)} for {people} traveller{people === 1 ? "" : "s"} over {days} {days === 1 ? "day" : "days"}. Off we go!
            </p>
          </div>
        </motion.li>

        {stops.map((s, i) => {
          const kind = kindOf(s.category, s.name);
          const side = i % 2 === 0 ? "ts-l" : "ts-r";
          const firstOfDay = i === 0 || dayOf[i] !== dayOf[i - 1];
          const km = s.arrivalKmFromPrev;
          const href = planStopHref(s.id, s.meta?.citySeedSlug);
          return (
            <Fragment key={s.id}>
              {firstOfDay && (
                <li className="ts-day">
                  <span>
                    Day {dayOf[i] + 1} · {DAY_NAMES[dayOf[i]] ?? `Day ${dayOf[i] + 1}`}
                  </span>
                </li>
              )}
              <motion.li className={`ts-node ${side}`} variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
                <span className="ts-dot">{i + 1}</span>
                <article className="ts-card">
                  {(() => {
                    const pic = (
                      <>
                        {s.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <span aria-hidden>{KIND_EMOJI[kind]}</span>
                        )}
                        <em aria-hidden>{KIND_EMOJI[kind]}</em>
                      </>
                    );
                    return href ? (
                      <Link href={href} className="ts-pic ts-link" aria-label={`Open ${s.name}`}>
                        {pic}
                      </Link>
                    ) : (
                      <div className="ts-pic">{pic}</div>
                    );
                  })()}
                  <div className="ts-txt">
                    <small>
                      Chapter {i + 1} · {KIND_LABEL[kind]}
                    </small>
                    <h3>{href ? <Link href={href}>{s.name}</Link> : s.name}</h3>
                    <p className="ts-teddy">
                      <span className="ts-who" title="Teddy">🐻</span> {teddyLine(kind, s.name, i)}
                    </p>
                    <ul className="ts-chips">
                      <li title="Juno, the navigator">
                        🦊 {km > 0.05 ? `${fmtKm(km)} · ${fmtMinutes(s.arrivalMinutesFromPrev)} from the last stop` : "right where we are"}
                      </li>
                      <li title="Pip, the treasurer">
                        🦉 {s.stopCost > 0 ? `${formatINR(s.stopCost)} into the ledger` : "free — the coins stay put"}
                      </li>
                      <li>⏱ about {fmtMinutes(s.idealMinutes)} here</li>
                      {s.rating ? <li>⭐ {s.rating.toFixed(1)}</li> : null}
                      {href && (
                        <li className="ts-open">
                          <Link href={href}>View place →</Link>
                        </li>
                      )}
                    </ul>
                  </div>
                </article>
              </motion.li>
            </Fragment>
          );
        })}

        <motion.li className="ts-node ts-end" variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }}>
          <span className="ts-dot">🏡</span>
          <div className="ts-card ts-card-wide">
            <small>Home sweet home</small>
            <h3>Pip&rsquo;s ledger</h3>
            <div className={`ts-meter ${over ? "is-over" : ""}`} aria-hidden>
              <i style={{ width: `${used}%` }} />
              <b style={{ left: `${used}%` }}>🪙</b>
            </div>
            <p>
              <b>🦉 Pip</b> {over ? `shuffles nervously — this plan runs ${formatINR(totals.cost - budget)} over your ${formatINR(budget)}.` : `tucks ${formatINR(totals.cost)} of your ${formatINR(budget)} into the ledger and keeps ${formatINR(totals.unspentBudget)} safe for chai and souvenirs.`}
            </p>
            <ul className="ts-chips">
              <li>⛽ Travel {formatINR(totals.fuelTotal)}</li>
              <li>🎟 Entry {formatINR(totals.entryFeesTotal)}</li>
              <li>🍛 Food {formatINR(totals.foodTotal)}</li>
              {totals.stayTotal ? <li>🛏 Stay {formatINR(totals.stayTotal)}</li> : null}
              <li>👤 {formatINR(totals.perPersonCost)} each</li>
            </ul>
          </div>
        </motion.li>
      </ol>
    </section>
  );
}

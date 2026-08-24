"use client";

import { useEffect, useRef, useState } from "react";

// A controlled number input that can actually be cleared. A plain
// `value={value}` + `onChange={(e) => onChange(Number(e.target.value) || 0)}`
// snaps back to the clamped number on every keystroke — so clearing the field
// to type a fresh value (e.g. replacing "2" with "10") immediately re-renders
// as the old/clamped value and the field never looks empty. This keeps its own
// draft string so the box can go blank while typing.
//
// BUG-05: while the box was blank it did NOT push a value, so the live budget
// kept quietly using the LAST number typed — clear "₹350" from "Food / person"
// and the total still charged ₹350 per head while the field read empty. An
// emptied field now reports `min` straight away (₹0 for food), so what you see
// and what the total charges always agree. The box itself still shows blank
// while you type, and blurring an empty box settles it on `min`.
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  const [raw, setRaw] = useState(String(value));
  // The last number this field itself pushed upward. Lets the sync effect below
  // tell "the parent changed the value" (adopt it) from "the parent is just
  // echoing back what we sent" (keep the draft, so an intentionally-blank box
  // isn't refilled with "0" the moment we report the empty field as `min`).
  const lastPushed = useRef<number | null>(null);

  useEffect(() => {
    if (lastPushed.current === value) return;
    lastPushed.current = null;
    setRaw(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function push(n: number) {
    lastPushed.current = n;
    onChange(n);
  }

  function commit(v: string) {
    const n = v.trim() === "" || Number.isNaN(Number(v)) ? min : Math.max(min, Math.min(max, Number(v)));
    lastPushed.current = null;
    onChange(n);
    setRaw(String(n));
  }

  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
      <div className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        {prefix && <span className="mr-1 text-sm text-slate-500">{prefix}</span>}
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={raw}
          onChange={(e) => {
            const v = e.target.value;
            setRaw(v);
            if (v.trim() === "") {
              // Blank reads as the minimum RIGHT NOW, so the live total never
              // shows a figure the field doesn't.
              push(min);
            } else if (!Number.isNaN(Number(v))) {
              push(Math.max(min, Math.min(max, Number(v))));
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
        />
      </div>
    </label>
  );
}

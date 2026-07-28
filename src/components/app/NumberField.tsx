"use client";

import { useEffect, useState } from "react";

// A controlled number input that can actually be cleared. A plain
// `value={value}` + `onChange={(e) => onChange(Number(e.target.value) || 0)}`
// snaps back to the clamped number on every keystroke — so clearing the field
// to type a fresh value (e.g. replacing "2" with "10") immediately re-renders
// as the old/clamped value and the field never looks empty. This keeps its own
// draft string so the box can go blank while typing; only a *valid* number
// pushes `onChange` immediately (so live totals still update as you type), and
// leaving it blank on blur falls back to `min`.
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

  useEffect(() => {
    setRaw(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function commit(v: string) {
    const n = v.trim() === "" || Number.isNaN(Number(v)) ? min : Math.max(min, Math.min(max, Number(v)));
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
            if (v.trim() !== "" && !Number.isNaN(Number(v))) {
              onChange(Math.max(min, Math.min(max, Number(v))));
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
        />
      </div>
    </label>
  );
}

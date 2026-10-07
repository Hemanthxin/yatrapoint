"use client";

// Little pictorial read-outs that sit beside the wizard's inputs, so choosing
// numbers feels like arranging objects rather than filling a form.

/** A pile of coins that grows with the budget (₹1K → one coin, ₹50K → a tall tower). */
export function CoinStack({ budget }: { budget: number }) {
  const n = Math.max(1, Math.min(10, Math.ceil(budget / 5000)));
  const left = Math.ceil(n / 2);
  const right = n - left;
  const coin = (i: number, x: number, base: number) => (
    <g key={`${x}-${i}`} className="q-coin" style={{ animationDelay: `${i * 0.04}s` }}>
      <ellipse cx={x} cy={base - i * 8 + 5} rx="21" ry="7" fill="#c9972f" stroke="#8a6a1c" strokeWidth="1.4" />
      <ellipse cx={x} cy={base - i * 8} rx="21" ry="7" fill="#f1cf6a" stroke="#8a6a1c" strokeWidth="1.4" />
      <text x={x} y={base - i * 8 + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#7a5a10">
        ₹
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 110 100" className="q-coins" aria-hidden>
      {Array.from({ length: left }, (_, i) => coin(i, 34, 84))}
      {Array.from({ length: right }, (_, i) => coin(i, 74, 88))}
    </svg>
  );
}

/** ☀ for every day, 🌙 for every night between them. */
export function DaySuns({ days }: { days: number }) {
  const items: string[] = [];
  for (let d = 0; d < days; d++) {
    items.push("☀️");
    if (d < days - 1) items.push("🌙");
  }
  return (
    <p className="q-days" aria-hidden>
      {items.map((e, i) => (
        <span key={`${days}-${i}`} style={{ animationDelay: `${i * 0.07}s` }}>
          {e}
        </span>
      ))}
    </p>
  );
}

const FACES = ["🧑", "👩", "🧒", "👨", "👧"];
/** A row of tiny travellers — one per person. */
export function PeopleHeads({ count }: { count: number }) {
  const n = Math.max(1, Math.min(5, count));
  return (
    <p className="q-people" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={`${n}-${i}`} style={{ animationDelay: `${i * 0.08}s` }}>
          {FACES[i % FACES.length]}
        </span>
      ))}
      {count >= 5 && <b>+</b>}
    </p>
  );
}

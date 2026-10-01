"use client";

// `next/dynamic` with `ssr: false` is only allowed from a Client Component —
// the dashboard page itself is a Server Component (it awaits the DB queries),
// so this one-line wrapper is what actually does the SSR-disabled import.
import dynamic from "next/dynamic";

export const Dashboard3DRoot = dynamic(
  () => import("./Dashboard3DRoot").then((m) => m.Dashboard3DRoot),
  { ssr: false }
);

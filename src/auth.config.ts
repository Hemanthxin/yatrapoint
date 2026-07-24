import type { NextAuthConfig } from "next-auth";

// Edge-safe NextAuth config. This file MUST NOT import anything that pulls
// in Node.js APIs (crypto, bcrypt, the DB adapter, jose) because the
// middleware loads it under the Edge Runtime.
//
// All providers live in auth.ts (Node runtime). The middleware only needs
// JWT validity, which NextAuth handles via AUTH_SECRET.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  // Derive the redirect origin from the incoming request's Host header
  // instead of the AUTH_URL env var — without this, a stale AUTH_URL (e.g.
  // still pointing at the old yatrapoint.vercel.app deployment) sends
  // sign-out/delete-account redirects to a dead domain regardless of which
  // domain the user is actually on.
  trustHost: true,
  // Providers are added by ./auth.ts in the Node runtime; leaving this empty
  // means the Edge runtime never tries to require provider modules.
  providers: [],
  callbacks: {},
} satisfies NextAuthConfig;

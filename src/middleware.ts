import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Middleware runs on the Edge Runtime, so it MUST use the edge-safe
// auth.config (no DB adapter, no bcryptjs). The full auth.ts is reserved
// for API routes and server components running on Node.
const { auth } = NextAuth(authConfig);

const PROTECTED = [
  "/dashboard",
  "/destinations",
  "/budget-planner",
  "/trip-categories",
  "/hidden-places",
  "/one-day-trips",
  "/explore-bangalore",
  "/multi-stop/live",
  "/community",
  "/festivals",
  "/profile",
];

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = !!req.auth;
  const isProtected = PROTECTED.some((p) => nextUrl.pathname.startsWith(p));

  if (isProtected && !isAuthed) {
    const url = new URL("/", nextUrl);
    url.searchParams.set("from", nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  // Run on everything except static assets and the auth API itself.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)"],
};

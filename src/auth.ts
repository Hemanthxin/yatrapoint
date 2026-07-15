import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { verifyOtpSchema, toE164, loginSchema, normalisePhone } from "@/lib/validators";
import { verifyOtp } from "@/lib/otp/service";
import { verifyGoogleIdToken } from "@/lib/google-id-token";
import {
  adminDisplayName,
  isAdminEmail,
  validateAdminCredentials,
} from "@/lib/admin";

// Full NextAuth config — DB adapter + phone-OTP + Google Identity Services
// (ID-token flow, no client secret required). Used by API routes and server
// components. The Edge middleware uses ./auth.config directly.

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      phone?: string | null;
      role?: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    phone?: string | null;
    role?: "USER" | "ADMIN";
  }
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    // ── Phone + password ──
    Credentials({
      id: "password",
      name: "Phone",
      credentials: {
        phone: { label: "Mobile number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const phone = normalisePhone(parsed.data.phone);
        if (!phone) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.phone, phone))
          .limit(1);
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
          phone: user.phone ?? undefined,
          image: user.image ?? undefined,
          role: isAdminEmail(user.email) ? ("ADMIN" as const) : ("USER" as const),
        };
      },
    }),

    // ── Google Identity Services (ID-token flow, no client secret) ──
    Credentials({
      id: "google-id-token",
      name: "Google",
      credentials: {
        credential: { label: "ID Token", type: "text" },
      },
      async authorize(raw) {
        if (
          !raw ||
          typeof raw.credential !== "string" ||
          raw.credential.length === 0
        ) {
          return null;
        }

        const claims = await verifyGoogleIdToken(raw.credential);
        if (!claims) return null;

        const email = claims.email;
        const now = new Date();

        const existing = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing[0]) {
          await db
            .update(users)
            .set({
              name: existing[0].name ?? claims.name ?? null,
              image: existing[0].image ?? claims.picture ?? null,
              emailVerified: claims.email_verified
                ? existing[0].emailVerified ?? now
                : existing[0].emailVerified,
              updatedAt: now,
            })
            .where(eq(users.id, existing[0].id));
          return {
            id: existing[0].id,
            name: existing[0].name ?? claims.name ?? undefined,
            email: existing[0].email ?? email,
            image: existing[0].image ?? claims.picture ?? undefined,
            role: "USER" as const,
          };
        }

        const [created] = await db
          .insert(users)
          .values({
            name: claims.name ?? null,
            email,
            image: claims.picture ?? null,
            emailVerified: claims.email_verified ? now : null,
          })
          .returning();

        return {
          id: created.id,
          name: created.name ?? undefined,
          email: created.email ?? undefined,
          image: created.image ?? undefined,
          role: "USER" as const,
        };
      },
    }),

    // ── Admin email/password credentials ──
    Credentials({
      id: "admin-credentials",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        if (!raw) return null;
        const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
        const password = typeof raw.password === "string" ? raw.password : "";
        if (!validateAdminCredentials(email, password)) return null;

        return {
          id: `admin:${email}`,
          name: adminDisplayName(email),
          email,
          image: null,
          role: "ADMIN" as const,
        };
      },
    }),

    // ── Phone + OTP credentials ──
    Credentials({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "OTP", type: "text" },
      },
      async authorize(raw) {
        const parsed = verifyOtpSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { phone, code } = parsed.data;

        const result = await verifyOtp(phone, code);
        if (!result.ok) return null;

        const e164 = toE164(phone);
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.phone, e164))
          .limit(1);

        const now = new Date();
        if (existing[0]) {
          await db
            .update(users)
            .set({ phoneVerified: now, updatedAt: now })
            .where(eq(users.id, existing[0].id));
          return {
            id: existing[0].id,
            phone: existing[0].phone ?? e164,
            role: isAdminEmail(existing[0].email) ? ("ADMIN" as const) : ("USER" as const),
          };
        }

        const [created] = await db
          .insert(users)
          .values({ phone: e164, phoneVerified: now })
          .returning();

        return { id: created.id, phone: created.phone ?? e164, role: "USER" as const };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
        if (typeof user.email === "string" && isAdminEmail(user.email)) {
          token.role = "ADMIN";
        }
        if (typeof user.phone === "string") token.phone = user.phone;
      }
      // Hydrate phone lazily so older tokens survive across requests — but only
      // once per token (via `phoneChecked`), not on every request. Without this
      // flag, users who simply have no phone (Google/admin sign-in) would fail
      // the `!token.phone` check forever and re-query the DB on every `auth()`
      // call, i.e. on nearly every page load.
      if (token.id && !token.phone && !token.phoneChecked) {
        const [row] = await db
          .select({ phone: users.phone, email: users.email })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        if (row?.phone) token.phone = row.phone;
        if (!token.role) token.role = row?.email && isAdminEmail(row.email) ? "ADMIN" : "USER";
        token.phoneChecked = true;
      }
      if (!token.role) token.role = "USER";
      return token;
    },
    async session({ session, token }) {
  if (token.id) {
    session.user.id = String(token.id);
  }

  if (token.phone) {
    session.user.phone = String(token.phone);
  }

  session.user.role =
    (token.role as "USER" | "ADMIN" | undefined) ?? "USER";

  return session;
}
  },
});

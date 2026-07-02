"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import {
  AtSign,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { signupAction } from "@/lib/actions/account";
import { loginSchema, signupSchema } from "@/lib/validators";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            ux_mode?: "popup" | "redirect";
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: string | number;
              logo_alignment?: "left" | "center";
            }
          ) => void;
        };
      };
    };
  }
}

type Mode = "login" | "signup";

export function AuthCard({ googleClientId }: { googleClientId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gisLoaded, setGisLoaded] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      const parsed = signupSchema.safeParse({ name, identifier, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check your details.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await signupAction({ name, identifier, password });
        if (!res.ok) {
          setError(res.error ?? "Could not sign you up.");
          return;
        }
        const login = await signIn("password", { identifier, password, redirect: false });
        if (!login || login.error) {
          setError("Account created — please log in.");
          setMode("login");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // login
    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your details.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn("password", { identifier, password, redirect: false });
      if (!res || res.error) {
        setError("Wrong email/mobile or password.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Google Identity Services button.
  useEffect(() => {
    if (!gisLoaded || !googleClientId || !googleBtnRef.current) return;
    if (!window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: "popup",
        auto_select: false,
        callback: async (resp) => {
          if (!resp.credential) {
            setGoogleError("Google didn't return a credential.");
            return;
          }
          setGoogleError(null);
          const result = await signIn("google-id-token", { credential: resp.credential, redirect: false });
          if (!result || result.error) {
            setGoogleError("Google sign-in failed.");
            return;
          }
          router.push("/dashboard");
          router.refresh();
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: googleBtnRef.current.offsetWidth || 320,
        logo_alignment: "left",
      });
    } catch {
      setGoogleError("Could not load Google sign-in.");
    }
  }, [gisLoaded, googleClientId, router, mode]);

  return (
    <div className="relative w-full max-w-md animate-fadeUp">
      {/* Glow aura */}
      <div
        aria-hidden
        className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-blue-400/50 via-emerald-400/25 to-transparent blur-2xl"
      />

      <div className="relative overflow-hidden rounded-[1.85rem] border border-white/60 bg-white/90 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        {/* Gradient banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-500 px-7 pb-8 pt-7 text-white">
          <span aria-hidden className="sheen-overlay animate-sheen" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Saafera
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
              {mode === "login" ? "Welcome back 👋" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-white/85">
              {mode === "login" ? "Log in to plan your next trip." : "Join and start planning in seconds."}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          {/* Segmented mode toggle */}
          <div className="relative mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-bold">
            <span
              aria-hidden
              className={`absolute inset-y-1 w-1/2 rounded-xl bg-white shadow-sm transition-transform duration-300 ${
                mode === "signup" ? "translate-x-[calc(100%-0.5rem)]" : "translate-x-1"
              }`}
              style={{ left: 0 }}
            />
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`relative z-10 rounded-xl py-2 transition ${mode === "login" ? "text-emerald-700" : "text-slate-500"}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`relative z-10 rounded-xl py-2 transition ${mode === "signup" ? "text-emerald-700" : "text-slate-500"}`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <Field icon={<User className="h-4 w-4" />}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full bg-transparent py-3 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400"
                />
              </Field>
            )}

            <Field icon={<AtSign className="h-4 w-4" />}>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email or mobile number"
                autoComplete="username"
                className="w-full bg-transparent py-3 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400"
              />
            </Field>

            <Field icon={<Lock className="h-4 w-4" />}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full bg-transparent py-3 pl-10 pr-11 text-sm outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 transition hover:text-slate-600"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!submitting && <span aria-hidden className="sheen-overlay animate-sheen" />}
              <span className="relative">
                {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
              </span>
              {!submitting && <ArrowRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />}
            </button>
          </form>

          {googleClientId && (
            <>
              <div className="my-4 flex items-center gap-3 text-xs font-semibold text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                OR
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <Script
                src="https://accounts.google.com/gsi/client"
                strategy="afterInteractive"
                onLoad={() => setGisLoaded(true)}
              />
              <div ref={googleBtnRef} className="flex w-full justify-center" aria-label="Continue with Google" />
              {!gisLoaded && <p className="mt-2 text-center text-xs text-slate-400">Loading Google…</p>}
              {googleError && <p className="mt-2 text-center text-xs text-rose-500">{googleError}</p>}
            </>
          )}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Secured — we never share your details.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white transition focus-within:border-emerald-400 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
      <span className="pointer-events-none absolute left-3.5 text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedWords } from "@/components/app/AnimatedWords";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  User,
  Smartphone,
  Check,
  Plane,
} from "lucide-react";

import { signupAction } from "@/lib/actions/account";
import { loginSchema, signupSchema } from "@/lib/validators";
import { Modal } from "@/components/app/Modal";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";
import { TermsOfServiceContent } from "@/components/legal/TermsOfServiceContent";

// Google Identity Services typing (shared with the desktop AuthCard).
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
const sanitizePhone = (v: string) => v.replace(/\D/g, "").slice(0, 10);

// The Saafera mobile login — matches the brand mockup: cream hero with the
// wordmark and "Your Journey, Our Priority", over a white bottom-sheet form.
// Google-only social sign-in, with Remember me + Forgot password.
export function MobileLogin({ googleClientId }: { googleClientId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  const [gisLoaded, setGisLoaded] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // If Google's script never loads (network block, ad blocker, offline) don't
  // leave the user staring at "Loading Google…" forever — time out and show
  // a message instead.
  useEffect(() => {
    if (!googleClientId || gisLoaded) return;
    const timer = setTimeout(() => {
      setGoogleError((prev) => prev ?? "Google sign-in isn't available right now — use your phone number instead.");
    }, 7000);
    return () => clearTimeout(timer);
  }, [googleClientId, gisLoaded]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (!agreed) {
        setError("Please accept the Privacy Policy and Terms of Service to continue.");
        return;
      }
      const parsed = signupSchema.safeParse({ name, phone, password, confirmPassword });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check your details.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await signupAction({ name, phone, password, confirmPassword });
        if (!res.ok) {
          setError(res.error ?? "Could not sign you up.");
          return;
        }
        const login = await signIn("password", { phone, password, redirect: false });
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

    const parsed = loginSchema.safeParse({ phone, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter your details.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn("password", { phone, password, redirect: false });
      if (!res || res.error) {
        setError("Wrong mobile number or password.");
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
        width: googleBtnRef.current.offsetWidth || 300,
        logo_alignment: "center",
      });
    } catch {
      setGoogleError("Could not load Google sign-in.");
    }
  }, [gisLoaded, googleClientId, router, mode]);

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: "var(--app-bg)" }}>
      {/* Hero photo banner — full width, fading cleanly into the cream canvas
          so nothing overlaps the heading below. */}
      <motion.div
        initial={{ scale: 1.12, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-56 w-full overflow-hidden rounded-b-[2.5rem]"
      >
        <Image src="/66242.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-transparent" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--app-bg)] to-transparent"
        />
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-6 top-6"
        >
          <Image
            src="/saafera-logo.jpg"
            alt="Saafera"
            width={280}
            height={280}
            priority
            className="app-logo h-auto w-24 rounded-xl"
          />
        </motion.div>
      </motion.div>

      {/* Heading on the cream canvas — clean, no overlap with the photo. */}
      <div className="px-6 pt-4">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
        >
          <Plane className="h-3.5 w-3.5 -rotate-[18deg]" /> Your journey starts here
        </motion.span>
        <h1 className="mt-3 text-[2rem] font-extrabold leading-[1.12] tracking-tight text-slate-900">
          <AnimatedWords text="Explore More." delay={0.45} stagger={0.06} />
          <br />
          <span className="text-[#e14434]">
            <AnimatedWords text="Fulfill Soul." delay={0.65} stagger={0.06} />
          </span>
        </h1>
        <motion.span
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
          style={{ transformOrigin: "left" }}
          className="mt-3 block h-1 w-9 rounded-full bg-emerald-600"
        />
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.0 }}
          className="mt-2.5 max-w-[17rem] text-sm font-medium leading-relaxed text-slate-500"
        >
          Smart itineraries, real budgets and unforgettable experiences.
        </motion.p>
      </div>

      {/* Bottom-sheet form card — slides up from below, like it's being
          pulled into place. */}
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mt-7 rounded-t-[2.25rem] bg-white px-6 pb-12 pt-7 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.15)]"
      >
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {mode === "login" ? "Welcome back! 👋" : "Create account ✨"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "login" ? "Log in to continue your adventure" : "Join and start planning in seconds"}
        </p>

        {/* Segmented toggle — spring-physics sliding pill via layoutId */}
        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <ToggleBtn active={mode === "login"} onClick={() => switchMode("login")}>Log In</ToggleBtn>
          <ToggleBtn active={mode === "signup"} onClick={() => switchMode("signup")}>Sign Up</ToggleBtn>
        </div>

        <motion.form
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          onSubmit={onSubmit}
          className="mt-4 space-y-3"
        >
          <AnimatePresence mode="popLayout">
            {mode === "signup" && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Field icon={<User className="h-4 w-4" />}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    className="w-full bg-transparent py-3.5 pl-11 pr-3 text-sm outline-none placeholder:text-slate-400"
                  />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phone with flag + code */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white pl-3 transition focus-within:border-emerald-400 focus-within:shadow-[0_0_0_4px_var(--ring)]"
          >
            <span className="flex items-center gap-1 border-r border-slate-200 pr-2.5 text-sm font-semibold text-slate-700">
              <span className="text-base">🇮🇳</span> +91
            </span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(sanitizePhone(e.target.value))}
              placeholder="Enter mobile number"
              autoComplete="tel"
              className="w-full bg-transparent py-3.5 pr-3 text-sm outline-none placeholder:text-slate-400"
            />
            <Smartphone className="mr-3 h-4 w-4 shrink-0 text-emerald-600" />
          </motion.div>

          {/* Password */}
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <Field icon={<Lock className="h-4 w-4" />}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full bg-transparent py-3.5 pl-11 pr-11 text-sm outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </Field>
          </motion.div>

          <AnimatePresence mode="popLayout">
            {mode === "signup" && (
              <motion.div
                key="confirm-field"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Field icon={<Lock className="h-4 w-4" />}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    className="w-full bg-transparent py-3.5 pl-11 pr-3 text-sm outline-none placeholder:text-slate-400"
                  />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Remember me */}
          {mode === "login" && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setRemember((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-slate-600"
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-md border transition ${
                    remember ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {remember && <Check className="h-3.5 w-3.5" />}
                </span>
                Remember me
              </button>
            </div>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setLegalModal("privacy")}
                  className="font-semibold text-emerald-700 underline underline-offset-2"
                >
                  Privacy Policy
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => setLegalModal("terms")}
                  className="font-semibold text-emerald-700 underline underline-offset-2"
                >
                  Terms of Service
                </button>
                .
              </span>
            </label>
          )}

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || (mode === "signup" && !agreed)}
            className="group relative mt-1 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition active:scale-[0.98] disabled:opacity-60"
          >
            <span className="relative">
              {submitting ? "Please wait…" : mode === "login" ? "Log In" : "Create account"}
            </span>
            {!submitting && <ArrowRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />}
          </button>
        </motion.form>

        {googleClientId && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs font-semibold text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              or continue with
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <Script
              src="https://accounts.google.com/gsi/client"
              strategy="afterInteractive"
              onLoad={() => setGisLoaded(true)}
              onError={() => setGoogleError("Couldn't load Google sign-in — use your phone number instead.")}
            />
            <div ref={googleBtnRef} className="flex w-full justify-center" aria-label="Continue with Google" />
            {!gisLoaded && !googleError && <p className="mt-2 text-center text-xs text-slate-400">Loading Google…</p>}
            {googleError && <p className="mt-2 text-center text-xs text-rose-500">{googleError}</p>}
          </>
        )}

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Your data is safe with us
        </p>
      </motion.div>

      <Modal open={legalModal === "privacy"} onClose={() => setLegalModal(null)} title="Privacy Policy">
        <PrivacyPolicyContent />
      </Modal>
      <Modal open={legalModal === "terms"} onClose={() => setLegalModal(null)} title="Terms of Service">
        <TermsOfServiceContent />
      </Modal>
    </main>
  );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 overflow-hidden rounded-2xl border py-3 text-sm font-bold transition active:scale-95 ${
        active ? "border-emerald-600 text-emerald-700" : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {active && (
        <motion.span
          layoutId="mobile-toggle-pill"
          className="absolute inset-0 bg-emerald-50"
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white transition focus-within:border-emerald-400 focus-within:shadow-[0_0_0_4px_var(--ring)]">
      <span className="pointer-events-none absolute left-3.5 text-slate-400">{icon}</span>
      {children}
    </div>
  );
}

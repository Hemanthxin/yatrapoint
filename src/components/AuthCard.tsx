"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

import "./login.css";
import { signupAction } from "@/lib/actions/account";
import { loginSchema, signupSchema } from "@/lib/validators";
import { Modal } from "@/components/app/Modal";
import { PrivacyPolicyContent } from "@/components/legal/PrivacyPolicyContent";
import { TermsOfServiceContent } from "@/components/legal/TermsOfServiceContent";

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

// Accept only 10 digits in the phone box.
function sanitizePhone(v: string) {
  return v.replace(/\D/g, "").slice(0, 10);
}

export function AuthCard({ googleClientId }: { googleClientId?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two separate agreements — consent has to be specific, not bundled.
  const [privacyOk, setPrivacyOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const agreed = privacyOk && termsOk;
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
        setError("Please accept both the Privacy Policy and the Terms of Service to continue.");
        return;
      }
      const consent = { acceptedPrivacy: true as const, acceptedTerms: true as const };
      const parsed = signupSchema.safeParse({ name, phone, password, confirmPassword, ...consent });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check your details.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await signupAction({ name, phone, password, confirmPassword, ...consent });
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

    // login
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
        shape: "rectangular",
        width: googleBtnRef.current.offsetWidth || 320,
        logo_alignment: "left",
      });
    } catch {
      setGoogleError("Could not load Google sign-in.");
    }
  }, [gisLoaded, googleClientId, router, mode]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="relative w-full">
      <div className="lh-auth">
        <div className="lh-auth-head">
          <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>
          <p>{mode === "login" ? "Pick up your trip plans where you left off." : "Plan a trip around your budget in a few minutes."}</p>
        </div>

        <div className="lh-auth-body">
          {/* Segmented mode toggle — spring-physics sliding pill via layoutId,
              instead of a CSS transition. */}
          <div className="lh-tabs" role="tablist" aria-label="Log in or sign up">
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")} className={mode === "login" ? "is-on" : ""}>
              Log in
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")} className={mode === "signup" ? "is-on" : ""}>
              Sign up
            </button>
          </div>

          <motion.form
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            onSubmit={onSubmit}
            className="space-y-3.5"
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
                  <Field label="Full name" icon={<User className="h-4 w-4" />}>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      autoComplete="name"
                      className="w-full bg-transparent py-3 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400"
                    />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
              <Field label="Mobile number" icon={<span className="text-sm font-semibold text-slate-400">+91</span>} pad="left-3.5">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  className="w-full bg-transparent py-3 pl-14 pr-3 text-sm outline-none placeholder:text-slate-400"
                />
              </Field>
            </motion.div>

            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
              <Field label="Password" icon={<Lock className="h-4 w-4" />}>
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
                  <Field label="Confirm password" icon={<Lock className="h-4 w-4" />}>
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      className="w-full bg-transparent py-3 pl-10 pr-3 text-sm outline-none placeholder:text-slate-400"
                    />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>

            {mode === "signup" && (
              <div className="space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={privacyOk}
                    onChange={(e) => setPrivacyOk(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    I have read the{" "}
                    <button
                      type="button"
                      onClick={() => setLegalModal("privacy")}
                      className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                    >
                      Privacy Policy
                    </button>{" "}
                    and agree to Saafera using my details as described in it.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={termsOk}
                    onChange={(e) => setTermsOk(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setLegalModal("terms")}
                      className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                    >
                      Terms of Service
                    </button>
                    .
                  </span>
                </label>
              </div>
            )}

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting || (mode === "signup" && !agreed)} className="lh-submit">
              <span>{submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</span>
              {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
            </button>
          </motion.form>

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
                onError={() => setGoogleError("Couldn't load Google sign-in — use your phone number instead.")}
              />
              {/* While signing up, Google stays locked until both agreements are ticked. */}
              <div
                ref={googleBtnRef}
                className={`flex w-full justify-center transition ${mode === "signup" && !agreed ? "pointer-events-none opacity-40" : ""}`}
                aria-label="Continue with Google"
                aria-disabled={mode === "signup" && !agreed}
              />
              {mode === "signup" && !agreed && (
                <p className="mt-2 text-center text-xs text-slate-400">Tick both boxes above to continue with Google.</p>
              )}
              {!gisLoaded && !googleError && <p className="mt-2 text-center text-xs text-slate-400">Loading Google…</p>}
              {googleError && <p className="mt-2 text-center text-xs text-rose-500">{googleError}</p>}
            </>
          )}


        </div>
      </div>

      <Modal open={legalModal === "privacy"} onClose={() => setLegalModal(null)} title="Privacy Policy">
        <PrivacyPolicyContent />
      </Modal>
      <Modal open={legalModal === "terms"} onClose={() => setLegalModal(null)} title="Terms of Service">
        <TermsOfServiceContent />
      </Modal>
    </motion.div>
  );
}

function Field({
  label,
  icon,
  children,
  pad = "left-3.5",
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  pad?: string;
}) {
  return (
    <label className="lh-fieldwrap">
      <span className="lh-label">{label}</span>
      <div className="lh-field">
        <span className={`pointer-events-none absolute ${pad} text-slate-400`}>{icon}</span>
        {children}
      </div>
    </label>
  );
}

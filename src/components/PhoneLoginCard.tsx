"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ChevronDown, Lock, Phone } from "lucide-react";
import { signIn } from "next-auth/react";
import { z } from "zod";

import { phoneSchema } from "@/lib/validators";

const schema = z.object({ phone: phoneSchema });
type FormValues = z.infer<typeof schema>;

// Shape of Google Identity Services on window. We don't depend on the full
// GIS @types package; this minimal declaration is enough.
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
          prompt?: () => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

interface PhoneLoginCardProps {
  // Public Google client ID, passed in from the server component. We avoid
  // baking it into the bundle so a deployed copy without a configured client
  // simply shows no Google button.
  googleClientId?: string;
}

export function PhoneLoginCard({ googleClientId }: PhoneLoginCardProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [gisLoaded, setGisLoaded] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: values.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Could not send OTP. Try again.");
        return;
      }
      router.push(`/verify-otp?phone=${encodeURIComponent(values.phone)}`);
    } catch {
      setServerError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Initialise the Google Identity Services button once the SDK has loaded.
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
            setGoogleError("Google didn't return a credential. Try again.");
            return;
          }
          setGoogleError(null);
          const result = await signIn("google-id-token", {
            credential: resp.credential,
            redirect: false,
          });
          if (!result || result.error) {
            setGoogleError("Google sign-in failed on our end.");
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
  }, [gisLoaded, googleClientId, router]);

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 text-slate-900 shadow-2xl">
      <h2 className="text-center text-2xl font-bold text-slate-900">
        Welcome Back!
      </h2>
      <p className="mt-1 text-center text-sm text-slate-500">
        Login to continue your journey
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Enter Mobile Number
          </label>
          <div
            className={`flex items-stretch overflow-hidden rounded-xl border ${
              errors.phone ? "border-red-400" : "border-slate-300"
            } focus-within:border-brand-green focus-within:ring-2 focus-within:ring-brand-green/30`}
          >
            <div className="flex items-center gap-1 border-r border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              +91
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <div className="relative flex flex-1 items-center">
              <Phone className="absolute left-3 h-4 w-4 text-slate-400" />
              <input
                id="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="Enter mobile number"
                className="w-full bg-transparent py-3 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400"
                {...register("phone")}
              />
            </div>
          </div>
          {errors.phone && (
            <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
          )}
          {serverError && (
            <p className="mt-1 text-xs text-red-500">{serverError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || isSubmitting}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending OTP..." : "Continue"}
          {!submitting && (
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          )}
        </button>

        {googleClientId && (
          <>
            <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              OR
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <Script
              src="https://accounts.google.com/gsi/client"
              strategy="afterInteractive"
              onLoad={() => setGisLoaded(true)}
            />
            <div
              ref={googleBtnRef}
              className="flex w-full justify-center"
              aria-label="Sign in with Google"
            />
            {!gisLoaded && (
              <p className="text-center text-xs text-slate-400">
                Loading Google sign-in…
              </p>
            )}
            {googleError && (
              <p className="text-center text-xs text-red-500">{googleError}</p>
            )}
          </>
        )}

        <p className="flex items-center justify-center gap-1 pt-1 text-center text-xs text-slate-500">
          <Lock className="h-3 w-3" />
          We never share your number with anyone.
        </p>
      </form>
    </div>
  );
}

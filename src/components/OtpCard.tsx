"use client";

import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, Pencil, Smartphone } from "lucide-react";
import { signIn } from "next-auth/react";

interface OtpCardProps {
  phone: string;
  initialExpiresInSeconds: number;
}

const OTP_LENGTH = 6;

export function OtpCard({ phone, initialExpiresInSeconds }: OtpCardProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() =>
    Array(OTP_LENGTH).fill("")
  );
  const [remaining, setRemaining] = useState(initialExpiresInSeconds);
  const [resendIn, setResendIn] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [remaining]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const mmss = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [remaining]);

  function setDigitAt(i: number, value: string) {
    setError(null);
    const next = [...digits];
    next[i] = value;
    setDigits(next);
  }

  function onChange(i: number) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "");
      if (!raw) {
        setDigitAt(i, "");
        return;
      }
      // If user pasted multiple chars into one box, spread them.
      if (raw.length > 1) {
        const spread = raw.slice(0, OTP_LENGTH - i).split("");
        const next = [...digits];
        spread.forEach((c, k) => (next[i + k] = c));
        setDigits(next);
        const focusIdx = Math.min(OTP_LENGTH - 1, i + spread.length);
        inputsRef.current[focusIdx]?.focus();
        return;
      }
      setDigitAt(i, raw);
      if (i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
    };
  }

  function onKeyDown(i: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[i] && i > 0) {
        inputsRef.current[i - 1]?.focus();
      }
      if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
      if (e.key === "ArrowRight" && i < OTP_LENGTH - 1)
        inputsRef.current[i + 1]?.focus();
    };
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    text
      .slice(0, OTP_LENGTH)
      .split("")
      .forEach((c, k) => (next[k] = c));
    setDigits(next);
    inputsRef.current[Math.min(OTP_LENGTH - 1, text.length)]?.focus();
  }

  async function onVerify() {
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Enter the full 6-digit OTP");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await signIn("phone-otp", {
        phone,
        code,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Invalid or expired OTP. Try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not resend OTP");
        if (typeof data.retryAfterSeconds === "number") {
          setResendIn(data.retryAfterSeconds);
        }
        return;
      }
      setDigits(Array(OTP_LENGTH).fill(""));
      setRemaining(data.expiresInSeconds ?? 180);
      setResendIn(30);
      inputsRef.current[0]?.focus();
    } catch {
      setError("Network error. Try again.");
    }
  }

  return (
    <div className="relative w-full max-w-md animate-fadeUp">
      {/* Glowing emerald aura */}
      <div
        aria-hidden
        className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-emerald-400/40 via-teal-400/20 to-transparent blur-2xl"
      />
      <div className="relative overflow-hidden rounded-[1.85rem] bg-white/85 p-8 text-slate-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
        />
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/40">
          <Smartphone className="h-6 w-6" />
        </div>

      <h2 className="text-center text-2xl font-extrabold tracking-tight">
        <span className="text-gradient">Verify Your Number</span>
      </h2>
      <p className="mt-1 text-center text-sm text-slate-500">
        Enter the OTP sent to
      </p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <p className="font-semibold text-emerald-600">+91 {phone}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-slate-400 transition hover:text-slate-600"
          aria-label="Change number"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div
        className="mt-6 grid grid-cols-6 gap-2"
        role="group"
        aria-label="One-time passcode"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={d}
            onChange={onChange(i)}
            onKeyDown={onKeyDown(i)}
            onPaste={onPaste}
            aria-label={`Digit ${i + 1}`}
            className="h-14 rounded-2xl border border-slate-300 bg-white/80 text-center text-xl font-extrabold text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.18)]"
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-red-500">{error}</p>
      )}

      <p className="mt-3 text-center text-xs text-slate-500">
        OTP will expire in{" "}
        <span className="font-semibold text-emerald-600">{mmss}</span>
      </p>

      <button
        type="button"
        onClick={onVerify}
        disabled={submitting || remaining === 0}
        className="group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-emerald-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {!submitting && remaining !== 0 && <span aria-hidden className="sheen-overlay animate-sheen" />}
        <span className="relative">{submitting ? "Verifying..." : "Verify OTP"}</span>
        {!submitting && <ArrowRight className="relative h-4 w-4 transition group-hover:translate-x-0.5" />}
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        OR
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Change Number
      </button>

      <p className="mt-4 text-center text-xs text-slate-500">
        Didn&apos;t receive the OTP?{" "}
        {resendIn > 0 ? (
          <span className="text-slate-400">Resend in {resendIn}s</span>
        ) : (
          <button
            onClick={onResend}
            type="button"
            className="font-semibold text-emerald-600 hover:underline"
          >
            Resend OTP
          </button>
        )}
      </p>
      </div>
    </div>
  );
}

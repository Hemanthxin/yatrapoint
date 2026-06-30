"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, User, LogIn, Luggage } from "lucide-react";
import { signIn } from "next-auth/react";
import { z } from "zod";

const schema = z.object({
  username: z.string().trim().min(1, "Enter your admin email"),
  password: z.string().min(1, "Enter the password"),
});

type FormValues = z.infer<typeof schema>;

export function AdminLoginCard() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await signIn("admin-credentials", {
        email: values.username,
        password: values.password,
        redirect: false,
      });
      if (!res || res.error) {
        setServerError("Invalid admin credentials.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setServerError("Could not sign in. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative w-full max-w-md animate-fadeUp">
      {/* Amber aura glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-amber-400/40 via-orange-400/20 to-transparent blur-2xl"
      />
      <div className="relative overflow-hidden rounded-[1.85rem] border border-white/60 bg-white/85 p-8 text-slate-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-10">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
        />
        {/* Luggage icon */}
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/40">
          <Luggage className="h-10 w-10" strokeWidth={1.6} />
        </div>

      <h2 className="text-center text-3xl font-bold text-slate-900">Admin Login</h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        Access your travel app dashboard
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        {/* Username */}
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Username
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Enter username"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25"
              {...register("username")}
            />
          </div>
          {errors.username && (
            <p className="mt-1 text-xs text-rose-500">{errors.username.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>
          )}
        </div>

        {/* Remember */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          Remember me
        </label>

        {serverError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || submitting}
          className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-base font-bold text-white shadow-lg shadow-amber-500/40 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {!(isSubmitting || submitting) && <span aria-hidden className="sheen-overlay animate-sheen" />}
          <LogIn className="relative h-5 w-5" />
          <span className="relative">{isSubmitting || submitting ? "Signing in..." : "Login"}</span>
        </button>
      </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          © 2024 Travel App. All rights reserved.
        </p>
      </div>
    </div>
  );
}

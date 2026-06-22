"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { signIn } from "next-auth/react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("Enter a valid admin email"),
  password: z.string().min(1, "Enter the password"),
});

type FormValues = z.infer<typeof schema>;

export function AdminLoginCard() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await signIn("admin-credentials", {
        email: values.email,
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
    <div className="w-full max-w-md rounded-3xl bg-white p-8 text-slate-900 shadow-2xl">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-sky-50 text-sky-700">
        <ShieldCheck className="h-6 w-6" />
      </div>

      <h2 className="text-center text-2xl font-bold text-slate-900">
        Admin Login
      </h2>
      <p className="mt-1 text-center text-sm text-slate-500">
        Access the place management dashboard
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Admin Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Enter admin email"
            className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none transition focus:border-sky-500"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-rose-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter password"
              className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-12 outline-none transition focus:border-sky-500"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-rose-500">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || submitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting || submitting ? "Signing in..." : "Login"}
          {!isSubmitting && !submitting && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Allowed admins: Hemanth@admin.com, Sunil@admin.com, loki@admin.com, subu@admin.com
      </div>

      <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        © 2024 Travel App. All rights reserved.
      </p>
    </div>
  );
}

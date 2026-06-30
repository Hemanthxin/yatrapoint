"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Save } from "lucide-react";
import { updateProfile } from "@/lib/actions/profile";

const schema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Enter a valid email")
    .max(255)
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface ProfileFormProps {
  initial: { name: string; email: string };
  phone: string;
  userId: string;
}

export function ProfileForm({ initial, phone, userId }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    mode: "onTouched",
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const res = await updateProfile(values);
      if (!res.ok) {
        setServerError(res.error ?? "Could not save changes");
        return;
      }
      setSavedAt(Date.now());
      reset({ name: values.name ?? "", email: values.email ?? "" });
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-4 grid gap-4 md:grid-cols-2"
    >
      <Field label="Full name">
        <input
          {...register("name")}
          placeholder="Vinay Sri Hari"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        />
        {errors.name && <Err msg={errors.name.message ?? ""} />}
      </Field>

      <Field label="Email">
        <input
          type="email"
          {...register("email")}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        />
        {errors.email && <Err msg={errors.email.message ?? ""} />}
      </Field>

      <Field label="Phone (verified)">
        <input
          value={phone || "—"}
          disabled
          className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
        />
      </Field>

      <Field label="User ID">
        <input
          value={userId}
          disabled
          className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-500"
        />
      </Field>

      <div className="md:col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {savedAt ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {isPending ? "Saving…" : savedAt && !isDirty ? "Saved" : "Save changes"}
        </button>
        {serverError && (
          <p className="text-sm text-red-600">{serverError}</p>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Err({ msg }: { msg: string }) {
  return <p className="mt-1 text-xs text-red-500">{msg}</p>;
}

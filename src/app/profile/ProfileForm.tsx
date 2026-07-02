"use client";

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Check,
  Save,
  Camera,
  Loader2,
  Phone,
  AtSign,
} from "lucide-react";
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
  username: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9._]{3,30}$/,
      "3–30 chars: letters, numbers, dot or underscore"
    )
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(300, "Bio must be 300 characters or less").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface ProfileFormProps {
  initial: {
    name: string;
    email: string;
    username: string;
    bio: string;
    image: string | null;
  };
  phone: string;
  userId: string;
  stats: { posts: number; trips: number; saved: number };
}

export function ProfileForm({ initial, phone, stats }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Optimistic avatar preview, owned here so the header updates immediately.
  const [avatar, setAvatar] = useState<string | null>(initial.image);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial.name,
      email: initial.email,
      username: initial.username,
      bio: initial.bio,
    },
    mode: "onTouched",
  });

  const bioValue = watch("bio") ?? "";
  const usernameValue = watch("username") ?? "";
  const nameValue = watch("name") ?? "";

  const display = nameValue.trim() || initial.name || "Traveller";
  const initialChar = display.charAt(0).toUpperCase();

  function onAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setAvatarError("Please choose an image.");
      return;
    }
    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 512;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        saveAvatar(dataUrl);
      };
      img.onerror = () => setAvatarError("Could not read that image.");
      img.src = src;
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function saveAvatar(dataUrl: string) {
    const previous = avatar;
    setAvatar(dataUrl); // optimistic
    setAvatarUploading(true);
    startTransition(async () => {
      const res = await updateProfile({ image: dataUrl });
      setAvatarUploading(false);
      if (!res.ok) {
        setAvatar(previous); // revert
        setAvatarError(res.error ?? "Could not update photo.");
        return;
      }
      router.refresh();
    });
  }

  function onSubmit(values: FormValues) {
    setServerError(null);
    startTransition(async () => {
      const res = await updateProfile({
        name: values.name,
        email: values.email,
        username: values.username,
        bio: values.bio,
      });
      if (!res.ok) {
        setServerError(res.error ?? "Could not save changes");
        return;
      }
      setSavedAt(Date.now());
      reset({
        name: values.name ?? "",
        email: values.email ?? "",
        username: values.username ?? "",
        bio: values.bio ?? "",
      });
      router.refresh();
    });
  }

  return (
    <div>
      {/* Clean profile header */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Avatar with light ring + camera overlay */}
          <div className="relative shrink-0">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-24 w-24 rounded-full object-cover ring-1 ring-slate-200 sm:h-28 sm:w-28"
              />
            ) : (
              <div className="grid h-24 w-24 place-items-center rounded-full bg-emerald-50 text-4xl font-semibold text-emerald-700 ring-1 ring-slate-200 sm:h-28 sm:w-28">
                {initialChar}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              aria-label="Change profile photo"
              className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-70"
            >
              {avatarUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onAvatar}
              className="hidden"
            />
          </div>

          {/* Name, handle, bio */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">
              {display}
            </h1>
            {usernameValue.trim() || initial.username ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-slate-500">
                <AtSign className="h-3.5 w-3.5" />
                {usernameValue.trim() || initial.username}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-400">
                Set a username below
              </p>
            )}
            {(bioValue.trim() || initial.bio) && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {bioValue.trim() || initial.bio}
              </p>
            )}

            {/* Stats row */}
            <div className="mt-4 flex items-stretch justify-center divide-x divide-slate-200 sm:justify-start">
              <Stat label="Posts" value={stats.posts} />
              <Stat label="Trips" value={stats.trips} />
              <Stat label="Saved" value={stats.saved} />
            </div>
          </div>
        </div>
        {avatarError && (
          <p className="mt-3 text-center text-sm text-rose-600 sm:text-left">
            {avatarError}
          </p>
        )}
      </section>

      {/* Edit profile card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Edit profile
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Phone is linked via OTP and can&apos;t be changed here.
        </p>

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

          <Field label="Username">
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                {...register("username")}
                placeholder="yourhandle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
              />
            </div>
            {errors.username && <Err msg={errors.username.message ?? ""} />}
          </Field>

          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Bio
            </span>
            <textarea
              {...register("bio")}
              rows={3}
              maxLength={300}
              placeholder="Tell fellow travellers about yourself…"
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.bio ? <Err msg={errors.bio.message ?? ""} /> : <span />}
              <span
                className={`text-xs ${
                  bioValue.length > 300 ? "text-red-500" : "text-slate-400"
                }`}
              >
                {bioValue.length}/300
              </span>
            </div>
          </label>

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
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={phone || "—"}
                disabled
                className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm text-slate-500"
              />
            </div>
          </Field>

          <div className="flex items-center gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={isPending || !isDirty}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savedAt && !isDirty ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isPending
                ? "Saving…"
                : savedAt && !isDirty
                  ? "Saved"
                  : "Save changes"}
            </button>
            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          </div>
        </form>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-[68px] flex-col items-center px-4 first:pl-0">
      <span className="text-lg font-semibold leading-none text-slate-900">
        {value}
      </span>
      <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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

"use client";

import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Send, X } from "lucide-react";

import { createCommunity } from "@/lib/actions/communities";
import { resizeImage } from "@/lib/imageUpload";

export function CreateCommunityForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      setCoverImage(await resizeImage(file));
    } catch {
      setError("Could not read that image.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createCommunity({ name, description, coverImage: coverImage ?? undefined });
      if (!res.ok || !res.slug) return setError(res.error || "Could not create community.");
      onClose();
      router.push(`/community/groups/${res.slug}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {coverImage ? (
        <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImage} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => setCoverImage(null)}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-36 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-600 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          <span className="text-sm font-medium">Add a cover photo (optional)</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={onCover} className="hidden" />

      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 120))}
        placeholder="Community name (e.g. Coorg Travellers)"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="What's this community about?"
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full rounded-xl px-6 py-3.5 text-sm active:scale-95 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Create community
      </button>
    </form>
  );
}

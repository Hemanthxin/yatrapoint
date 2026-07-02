"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

import { deleteAdminPlace } from "@/lib/actions/admin";

export function DeletePlaceButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    start(async () => {
      await deleteAdminPlace(id);
      router.refresh();
    });
  }

  return (
    <button
      onClick={onDelete}
      disabled={pending}
      title="Delete place"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

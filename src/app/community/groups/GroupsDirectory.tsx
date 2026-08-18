"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";

import type { CommunitySummary } from "@/lib/queries/communities";
import { Modal } from "@/components/app/Modal";
import { EmptyState } from "@/components/app/EmptyState";
import { CommunityIllustration } from "@/components/illustrations";
import { RevealGrid } from "@/components/app/RevealGrid";
import { CreateCommunityForm } from "./CreateCommunityForm";
import { JoinButton, type MembershipStatus } from "./JoinButton";

export function GroupsDirectory({
  communities,
  memberships,
}: {
  communities: CommunitySummary[];
  memberships: Record<string, { role: string; status: string }>;
}) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [communities, query]);

  function statusFor(c: CommunitySummary): MembershipStatus {
    const m = memberships[c.id];
    if (!m) return "none";
    if (m.role === "owner") return "owner";
    return m.status === "approved" ? "approved" : "pending";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities…"
            className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] py-3 pl-11 pr-4 text-sm outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
          />
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary shrink-0 rounded-xl px-5 py-3 text-sm">
          <Plus className="h-4 w-4" /> Create community
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          illustration={CommunityIllustration}
          title={communities.length === 0 ? "No communities yet" : "No matches"}
          description={communities.length === 0 ? "Be the first to start one!" : "Try a different search."}
        />
      ) : (
        <RevealGrid className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <div key={c.id} className="card card-hover overflow-hidden">
              <Link href={`/community/groups/${c.slug}`} className="block">
                <div className="relative h-28 w-full bg-emerald-100">
                  {c.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                      <Users className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="space-y-2 p-4">
                <Link href={`/community/groups/${c.slug}`}>
                  <h3 className="truncate text-base font-bold text-[color:var(--text)] hover:underline">{c.name}</h3>
                </Link>
                <p className="line-clamp-2 text-sm text-[color:var(--muted)]">{c.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs font-medium text-[color:var(--muted)]">
                    {c.memberCount} {c.memberCount === 1 ? "member" : "members"} · {c.postCount} posts
                  </p>
                  <JoinButton communityId={c.id} initialStatus={statusFor(c)} />
                </div>
              </div>
            </div>
          ))}
        </RevealGrid>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a community">
        <CreateCommunityForm onClose={() => setCreateOpen(false)} />
      </Modal>
    </div>
  );
}

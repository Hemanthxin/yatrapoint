"use client";

import Link from "next/link";
import { X, Send } from "lucide-react";
import type { ConversationRow } from "@/lib/queries/messages";
import { timeAgo } from "@/lib/timeAgo";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";

export function MessagesInbox({ conversations }: { conversations: ConversationRow[] }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link
          href="/community"
          aria-label="Back to community"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 active:scale-90"
        >
          <X className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-base font-extrabold tracking-tight text-slate-900">Messages</h1>
      </header>

      <div className="mx-auto max-w-lg p-3">
        {conversations.length === 0 ? (
          <EmptyState
            illustration={NoDataIllustration}
            title="No messages yet"
            description="Visit a traveller's profile and tap Message to start a chat."
            action={
              <Send className="mx-auto h-5 w-5 text-emerald-600" aria-hidden />
            }
          />
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.otherUserId}>
                <Link
                  href={`/community/messages/${c.otherUserId}`}
                  className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white"
                >
                  {c.otherUserImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.otherUserImage} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-base font-bold text-white">
                      {c.otherUserName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{c.otherUserName}</p>
                    <p className={`truncate text-sm ${c.unreadCount > 0 ? "font-semibold text-slate-800" : "text-slate-400"}`}>
                      {c.lastFromMe && "You: "}
                      {c.lastBody}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-slate-400">{timeAgo(c.lastCreatedAt)}</span>
                    {c.unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { X, Heart, MessageCircle, UserPlus, MapPin as WantToGoIcon, CheckCircle2, CheckCheck } from "lucide-react";
import type { NotificationRow } from "@/lib/queries/notifications";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { timeAgo } from "@/lib/timeAgo";
import { EmptyState } from "@/components/app/EmptyState";
import { NoDataIllustration } from "@/components/illustrations";

const ICONS: Record<string, { icon: typeof Heart; className: string }> = {
  love: { icon: Heart, className: "text-rose-500" },
  wantToGo: { icon: WantToGoIcon, className: "text-emerald-600" },
  beenThere: { icon: CheckCircle2, className: "text-emerald-600" },
  comment: { icon: MessageCircle, className: "text-slate-700" },
  follow: { icon: UserPlus, className: "text-emerald-600" },
  message: { icon: MessageCircle, className: "text-emerald-600" },
};

function actionText(n: NotificationRow): string {
  switch (n.type) {
    case "love":
      return "loved your post";
    case "wantToGo":
      return "wants to go to your post";
    case "beenThere":
      return "has been to your post";
    case "comment":
      return n.commentBody ? `commented: "${n.commentBody.slice(0, 80)}"` : "commented on your post";
    case "follow":
      return "started following you";
    case "message":
      return "sent you a message";
    default:
      return "interacted with your post";
  }
}

export function NotificationsList({ notifications: initial }: { notifications: NotificationRow[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const hasUnread = notifications.some((n) => !n.read);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)]">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-b border-[color:var(--border)] px-4 py-3">
        <Link
          href="/community"
          aria-label="Back to community"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-2)] active:scale-90"
        >
          <X className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-base font-extrabold tracking-tight text-[color:var(--text)]">Notifications</h1>
        {hasUnread && (
          <button
            type="button"
            onClick={markAllRead}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </header>

      <div className="mx-auto max-w-lg p-3">
        {notifications.length === 0 ? (
          <EmptyState
            illustration={NoDataIllustration}
            title="No notifications yet"
            description="Reactions, comments and follows will show up here."
          />
        ) : (
          <ul className="space-y-1.5">
            {notifications.map((n) => {
              const meta = ICONS[n.type] ?? ICONS.love;
              const Icon = meta.icon;
              const href = n.type === "message" ? `/community/messages/${n.actorId}` : `/profile/${n.actorId}`;
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-2xl p-3 transition hover:bg-[color:var(--surface-2)] ${
                      n.read ? "" : "bg-emerald-50/60"
                    }`}
                  >
                    <span className="relative shrink-0">
                      {n.actorImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.actorImage} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                          {n.actorName?.charAt(0).toUpperCase() ?? "T"}
                        </span>
                      )}
                      <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--surface)] shadow">
                        <Icon className={`h-3 w-3 ${meta.className}`} fill={n.type === "love" ? "currentColor" : "none"} />
                      </span>
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-[color:var(--text-soft)]">
                      <span className="font-bold text-[color:var(--text)]">{n.actorName}</span> {actionText(n)}
                      <span className="ml-1.5 text-xs text-[color:var(--muted)]">{timeAgo(n.createdAt)}</span>
                    </p>
                    {n.postPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.postPhotoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    )}
                    {!n.read && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

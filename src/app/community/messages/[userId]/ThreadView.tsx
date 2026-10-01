"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import type { Message } from "@/lib/db/schema";
import { sendMessage, markThreadRead, refreshThread } from "@/lib/actions/messages";
import { timeAgo } from "@/lib/timeAgo";

const POLL_MS = 4000;

export function ThreadView({
  otherUserId,
  otherUserName,
  otherUserImage,
  currentUserId,
  initialMessages,
}: {
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, startSending] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCreatedAtRef = useRef<string | null>(
    initialMessages.length > 0 ? new Date(initialMessages[initialMessages.length - 1].createdAt).toISOString() : null
  );
  // Synchronous locks — plain refs, not state, so they take effect immediately
  // even within the same event-loop tick (React state updates are batched and
  // can lag by a render, which isn't fast enough to stop a double keydown).
  const sendingRef = useRef(false);
  const pollingRef = useRef(false);

  // Merge in new messages by id, so a duplicate arriving from either a
  // double-send or an overlapping poll tick can never render twice.
  function addMessages(incoming: Message[]) {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }

  useEffect(() => {
    markThreadRead(otherUserId);
  }, [otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (pollingRef.current) return; // previous tick still in flight — skip, don't overlap
      pollingRef.current = true;
      try {
        const res = await refreshThread(otherUserId, lastCreatedAtRef.current);
        if (res.messages.length > 0) {
          addMessages(res.messages);
          lastCreatedAtRef.current = new Date(res.messages[res.messages.length - 1].createdAt).toISOString();
          if (res.messages.some((m) => m.senderId === otherUserId)) markThreadRead(otherUserId);
        }
      } finally {
        pollingRef.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  function submit() {
    if (sendingRef.current) return; // guards against a double Enter/click firing before re-render
    const body = text.trim();
    if (!body) return;
    sendingRef.current = true;
    setText("");
    startSending(async () => {
      try {
        const res = await sendMessage(otherUserId, body);
        if (res.ok && res.message) {
          addMessages([res.message]);
          lastCreatedAtRef.current = new Date(res.message.createdAt).toISOString();
        } else {
          setText(body);
        }
      } finally {
        sendingRef.current = false;
      }
    });
  }

  return (
    <div className="flex h-screen flex-col bg-[color:var(--surface)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-[color:var(--border)] px-3 py-2.5">
        <Link
          href="/community/messages"
          aria-label="Back to messages"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-2)] active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {otherUserImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={otherUserImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            {otherUserName.charAt(0).toUpperCase()}
          </span>
        )}
        <Link href={`/profile/${otherUserId}`} className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--text)] hover:underline">
          {otherUserName}
        </Link>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-[color:var(--muted)]">
            Say hello to {otherUserName.split(" ")[0]} 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-emerald-600 text-white"
                      : "rounded-bl-sm bg-[color:var(--surface-2)] text-[color:var(--text)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "text-[color:var(--muted)]"}`}>{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-[color:var(--border)] p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-[color:var(--surface)] focus:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
        />
        <button
          onClick={submit}
          disabled={sending || !text.trim()}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 active:scale-90 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

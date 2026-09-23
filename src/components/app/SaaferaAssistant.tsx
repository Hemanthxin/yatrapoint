"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I'm the Saafera Assistant. Ask me how to use the app, check on a saved trip, or the best places to visit this month.",
};

// Floating chat entry point, mounted once in AppShell so it's reachable from
// every page. Bottom-right: clear of the centered mobile dock (MobileNav) and
// the top-left immersive menu button, the app's only other floating controls.
export function SaaferaAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reply) {
        setMessages((m) => replaceLast(m, data?.error || "Sorry, something went wrong. Please try again."));
        return;
      }
      setMessages((m) => replaceLast(m, data.reply));
    } catch {
      setMessages((m) => replaceLast(m, "Network error — check your connection and try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Saafera Assistant" : "Chat with the Saafera Assistant"}
        className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/40 transition active:scale-95 lg:bottom-6 lg:right-6"
      >
        <span aria-hidden className="sheen-overlay animate-sheen" />
        {open ? <X className="relative h-6 w-6" /> : <MessageCircle className="relative h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed inset-x-4 bottom-40 z-40 flex max-h-[65vh] flex-col overflow-hidden rounded-3xl border border-white/60 glass-strong shadow-[0_18px_50px_-12px_rgba(2,6,23,0.4)] sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-24">
          <div className="flex items-center gap-2 border-b border-white/40 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">Saafera Assistant</p>
              <p className="text-xs text-slate-500">Trip advice &amp; app help</p>
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-emerald-600 text-white" : "bg-white/85 text-slate-800"
                  }`}
                >
                  {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-white/40 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a trip, a place, or the app…"
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white transition disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function replaceLast(messages: ChatMessage[], content: string): ChatMessage[] {
  const copy = [...messages];
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}

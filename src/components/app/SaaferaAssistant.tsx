"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, X, Send } from "lucide-react";
import { useLocation } from "./LocationContext";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Only ever set on the latest assistant message — tappable follow-ups the
  // server guarantees will resolve to a real answer.
  suggestions?: string[];
}

const STARTER_SUGGESTIONS = ["Best places to visit this month", "What's near me?", "My trip plans", "Festivals this month"];

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hey, I'm the Saafera Assistant. Ask me about a place, your trips, or how the app works — here's a few to try:",
  suggestions: STARTER_SUGGESTIONS,
};

// Floating chat entry point, mounted once in AppShell so it's reachable from
// every page. Bottom-right: clear of the centered mobile dock (MobileNav) and
// the top-left immersive menu button, the app's only other floating controls.
export function SaaferaAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Which place the conversation is currently "about" — round-tripped with the
  // server so a short follow-up ("what's the entry fee?", "what's nearby?")
  // resolves without repeating the name. Cleared whenever an answer isn't
  // about one specific place.
  const [contextPlace, setContextPlace] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, coords, request } = useLocation();

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Ask for live location as soon as the traveller opens the chat — so a
  // "near me" / "from my location" question asked right after has a real fix
  // to work with instead of silently ignoring it.
  useEffect(() => {
    if (open && status === "idle") request();
  }, [open, status, request]);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setInput("");
    // Strip suggestions off every earlier message — only the newest reply
    // should ever show tappable chips.
    const history = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: text }];
    setMessages((m) => [...m.map(({ suggestions: _s, ...rest }) => rest), { role: "user", content: text }, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          location: status === "granted" ? { lat: coords.lat, lng: coords.lng } : null,
          contextPlace,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reply) {
        setMessages((m) => replaceLast(m, { content: data?.error || "Sorry, something went wrong. Please try again." }));
        return;
      }
      setContextPlace(typeof data.place === "string" ? data.place : null);
      setMessages((m) =>
        replaceLast(m, { content: data.reply, suggestions: Array.isArray(data.suggestions) ? data.suggestions : [] })
      );
    } catch {
      setMessages((m) => replaceLast(m, { content: "Network error — check your connection and try again." }));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {/* Launcher — pulsing glow ring (same language as the mobile dock's Plan
          button) plus a small "live" status dot so it reads as an active AI
          core, not a static icon. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Saafera Assistant" : "Chat with the Saafera Assistant"}
        className="fixed bottom-24 right-4 z-50 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 transition animate-glow active:scale-95 lg:bottom-6 lg:right-6"
      >
        <span aria-hidden className="sheen-overlay animate-sheen" />
        {open ? (
          <X className="relative h-6 w-6" />
        ) : (
          <>
            <Bot className="relative h-6 w-6" />
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2.5 w-2.5 animate-pulse rounded-full bg-teal-300 ring-2 ring-white"
            />
          </>
        )}
      </button>

      {open && (
        // Docked full-height panel on the right edge — the same layout
        // convention as the Claude/Codex chat sidebar in VS Code, instead of
        // a floating card. Full height on every screen size; a fixed width
        // on larger screens, full width on mobile.
        <div className="fixed inset-y-0 right-0 z-40 flex w-full animate-slideInRight flex-col overflow-hidden border-l border-emerald-200/60 bg-white shadow-[-18px_0_60px_-12px_rgba(2,6,23,0.35)] sm:w-[400px] lg:w-[440px]">
            <div className="relative flex items-center gap-2.5 overflow-hidden border-b border-emerald-100 px-4 py-3">
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-400/10 to-transparent" />
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-md shadow-emerald-500/40 animate-breathe">
                <Bot className="h-4 w-4" />
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="truncate bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-sm font-extrabold text-transparent">
                  Saafera Assistant
                </p>
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  {contextPlace ? `Talking about ${contextPlace}` : "Online — trip advice & app help"}
                </p>
              </div>
              {contextPlace && (
                <button
                  type="button"
                  onClick={() => setContextPlace(null)}
                  className="relative shrink-0 rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-500 transition hover:bg-white active:scale-95"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Saafera Assistant"
                className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                const isTyping = sending && isLast && m.role === "assistant" && !m.content;
                return (
                  <div key={i} className="animate-fadeIn">
                    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      {isTyping ? (
                        <TypingIndicator />
                      ) : (
                        <div className={`flex max-w-[88%] items-end gap-1.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                          {m.role === "assistant" && (
                            <span className="mb-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                              <Bot className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <div
                            className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                              m.role === "user"
                                ? "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30"
                                : "border border-emerald-100/70 bg-gradient-to-br from-white/95 to-emerald-50/60 text-slate-800"
                            }`}
                          >
                            <FormattedText text={m.content} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tappable follow-ups — only on the latest assistant reply, and
                        only every server-guaranteed-to-work suggestion. */}
                    {isLast && !sending && m.role === "assistant" && !!m.suggestions?.length && (
                      <div className="ml-6 mt-2 flex flex-wrap gap-1.5">
                        {m.suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void send(s)}
                            className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-50 active:scale-95"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-center gap-2 border-t border-white/40 p-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={contextPlace ? `Ask more about ${contextPlace}…` : "Ask about a trip, a place, or the app…"}
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/15"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 transition active:scale-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
        </div>
      )}
    </>
  );
}

// Replies use light markup (**bold**, "- " bullets, `code`) — render it as
// real bold text and tidy bullet rows instead of showing the raw symbols.
function FormattedText({ text }: { text: string }) {
  const lines = text.replace(/`/g, "").split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bullet = line.startsWith("- ");
        const body = bullet ? line.slice(2) : line;
        return (
          <div key={i} className={bullet ? "flex gap-2" : undefined}>
            {bullet && <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
            <span className="min-w-0">{renderInline(body)}</span>
          </div>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 rounded-2xl border border-emerald-100/70 bg-gradient-to-br from-white/95 to-emerald-50/60 px-4 py-3">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
    </div>
  );
}

function replaceLast(messages: ChatMessage[], patch: Partial<ChatMessage>): ChatMessage[] {
  const copy = [...messages];
  copy[copy.length - 1] = { ...copy[copy.length - 1], role: "assistant", ...patch };
  return copy;
}

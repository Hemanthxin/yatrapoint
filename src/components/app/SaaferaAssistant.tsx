"use client";

import "./assistant.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, RotateCcw } from "lucide-react";
import { useLocation } from "./LocationContext";
import { Owl } from "./journey/characters";
import { MountainScape, type ScapeLayer } from "@/components/storybook/MountainScape";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Only ever set on the latest assistant message — tappable follow-ups the
  // server guarantees will resolve to a real answer.
  suggestions?: string[];
}

// These four strings are known-good for the server, so they double as the
// welcome tiles — the emoji and blurb are decoration only.
const STARTER_SUGGESTIONS = ["Best places to visit this month", "What's near me?", "My trip plans", "Festivals this month"];
const TILES: { q: string; emoji: string; hint: string }[] = [
  { q: STARTER_SUGGESTIONS[0], emoji: "🏞️", hint: "Fresh ideas for now" },
  { q: STARTER_SUGGESTIONS[1], emoji: "📍", hint: "Spots around you" },
  { q: STARTER_SUGGESTIONS[2], emoji: "🗺️", hint: "Your saved plans" },
  { q: STARTER_SUGGESTIONS[3], emoji: "🎉", hint: "What's glowing soon" },
];

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hoo! I'm Pip, your Saafera guide. Ask me about a place, your trips, or how the app works — or pick one of these to start:",
  suggestions: STARTER_SUGGESTIONS,
};

// Little invitations that float out of the launcher now and then.
const NUDGES = ["Hoo! Need a trip idea?", "Ask me what's near you ✨", "Stuck on the planner? I can help!", "Curious what festival is next?"];
const THINKING = ["Pip is flipping through the map…", "Hoo — checking the trail…", "Counting the coins…", "Sniffing out hidden gems…"];
const NUDGE_KEY = "saafera/assistant-nudges";

// Short banner: ridges sit low, the 1600×900 art is cropped from the bottom.
const HEAD_RIDGES: ScapeLayer[] = [
  { color: "#dcc4f2", fade: "#ffe6cc", shade: "#bb98e0", base: 770, amp: 170, peaks: 4, snow: true },
  { color: "#4fc08a", fade: "#c4ecaa", shade: "#2f9f6c", base: 870, amp: 100, peaks: 7, trees: "pine", treeColor: "#2a9a66", treeCount: 40, treeSize: [24, 44] },
];

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
  // Index of the reply that is currently being "typed out" (null = none).
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const [thinkIdx, setThinkIdx] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const { status, coords, request } = useLocation();

  const scrollDown = useCallback((smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (open) scrollDown(true);
  }, [messages, open, scrollDown]);

  // Ask for live location as soon as the traveller opens the chat — so a
  // "near me" / "from my location" question asked right after has a real fix
  // to work with instead of silently ignoring it.
  useEffect(() => {
    if (open && status === "idle") request();
  }, [open, status, request]);

  // Rotate the "thinking" line while Pip waits for the server.
  useEffect(() => {
    if (!sending) return;
    setThinkIdx(Math.floor(Math.random() * THINKING.length));
    const t = window.setInterval(() => setThinkIdx((i) => (i + 1) % THINKING.length), 1700);
    return () => window.clearInterval(t);
  }, [sending]);

  // Pip's pupils follow the pointer while the launcher is showing.
  useEffect(() => {
    if (open) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const fab = fabRef.current;
        const look = fab?.querySelector<SVGGElement>(".ow-look");
        if (!fab || !look) return;
        const r = fab.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        const k = Math.min(1, d / 260);
        look.style.transform = `translate(${((dx / d) * 4 * k).toFixed(2)}px, ${((dy / d) * 3 * k).toFixed(2)}px)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open]);

  // A friendly nudge now and then — at most three a session, never once the chat has been used.
  useEffect(() => {
    if (open) {
      setNudge(null);
      return;
    }
    let shown = 0;
    try {
      shown = Number(sessionStorage.getItem(NUDGE_KEY) || 0);
    } catch {
      /* private mode */
    }
    if (shown >= 3) return;
    let hide = 0;
    const show = window.setTimeout(() => {
      setNudge(NUDGES[shown % NUDGES.length]);
      try {
        sessionStorage.setItem(NUDGE_KEY, String(shown + 1));
      } catch {
        /* ignore */
      }
      hide = window.setTimeout(() => setNudge(null), 7000);
    }, shown === 0 ? 5000 : 45000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [open]);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    setInput("");
    setTypingIdx(null);
    // Strip suggestions off every earlier message — only the newest reply
    // should ever show tappable chips.
    const history = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: text }];
    const replyIdx = messages.length + 1;
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
      setTypingIdx(replyIdx);
    } catch {
      setMessages((m) => replaceLast(m, { content: "Network error — check your connection and try again." }));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function resetChat() {
    if (sending) return;
    setMessages([GREETING]);
    setContextPlace(null);
    setTypingIdx(null);
    setInput("");
  }

  const fresh = messages.length === 1;

  return (
    <>
      {/* Launcher — Pip the owl in a gold-ringed badge. Wings beat on hover, the
          pupils follow your cursor, and a speech bubble floats out now and then.
          Rendered only while CLOSED: the docked panel has its own close button,
          and a launcher on top of the open panel would sit over its Send button. */}
      {!open && (
        <div className="sa-dock">
          {nudge && (
            <button type="button" className="sa-nudge" onClick={() => setOpen(true)} aria-label={`${nudge} Open the chat.`}>
              {nudge}
            </button>
          )}
          <button
            ref={fabRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Chat with the Saafera Assistant"
            className="sa-fab"
          >
            <span aria-hidden className="sa-fab-ring" />
            <span className="sa-owl sa-hover" aria-hidden>
              <Owl />
            </span>
            <span aria-hidden className="sa-dot" />
          </button>
        </div>
      )}

      {open && (
        // Docked full-height panel on the right edge — the same layout
        // convention as the Claude/Codex chat sidebar in VS Code, instead of
        // a floating card. Full height on every screen size; a fixed width
        // on larger screens, full width on mobile.
        <div className="sa-panel" role="dialog" aria-label="Saafera Assistant">
          <header className="sa-head">
            <div className="sa-sky" aria-hidden />
            <MountainScape layers={HEAD_RIDGES} idPrefix="sa" seed={9} className="sa-ridges" />
            <div className="sa-head-row">
              <span className={`sa-owl sa-pip ${sending ? "is-busy" : ""}`} aria-hidden>
                <span className="sa-hover">
                  <Owl />
                </span>
              </span>
              <div className="sa-title">
                <p>Saafera Assistant</p>
                <small>
                  <i aria-hidden />
                  {contextPlace ? `Talking about ${contextPlace}` : "Pip · online — trips, places & app help"}
                </small>
              </div>
              <button type="button" onClick={resetChat} aria-label="Start a fresh chat" title="Start a fresh chat" className="sa-icon" disabled={sending || fresh}>
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Saafera Assistant" className="sa-icon">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {contextPlace && (
            <div className="sa-topic">
              <span>
                📍 Talking about <b>{contextPlace}</b>
              </span>
              <button type="button" onClick={() => setContextPlace(null)}>
                Change topic
              </button>
            </div>
          )}

          <div ref={listRef} className="sa-list" data-lenis-prevent>
            {fresh && (
              <div className="sa-hero" aria-hidden>
                <span className="sa-owl sa-hero-pip">
                  <span className="sa-hover">
                    <Owl />
                  </span>
                </span>
                <i className="sa-spark sa-s1">✦</i>
                <i className="sa-spark sa-s2">✧</i>
                <i className="sa-spark sa-s3">✦</i>
              </div>
            )}

            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const isTyping = sending && isLast && m.role === "assistant" && !m.content;
              const animating = typingIdx === i;
              return (
                <div key={i} className="sa-row">
                  {isTyping ? (
                    <div className="sa-msg sa-ai">
                      <Avatar busy />
                      <div className="sa-bubble sa-b-ai sa-think">
                        <span>{THINKING[thinkIdx]}</span>
                        <b>
                          <i />
                          <i />
                          <i />
                        </b>
                      </div>
                    </div>
                  ) : (
                    <div className={`sa-msg ${m.role === "user" ? "sa-me" : "sa-ai"}`}>
                      {m.role === "assistant" && <Avatar />}
                      <div className={`sa-bubble ${m.role === "user" ? "sa-b-me" : "sa-b-ai"}`}>
                        {m.role === "assistant" ? (
                          <Reply text={m.content} animate={animating} onGrow={() => scrollDown()} onDone={() => setTypingIdx((t) => (t === i ? null : t))} />
                        ) : (
                          <FormattedText text={m.content} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* The very first message offers pictorial tiles; later replies get chips. */}
                  {isLast && !sending && !animating && m.role === "assistant" && !!m.suggestions?.length && (
                    i === 0 && fresh ? (
                      <div className="sa-tiles">
                        {TILES.map((t, k) => (
                          <button key={t.q} type="button" onClick={() => void send(t.q)} className="sa-tile" style={{ animationDelay: `${0.15 + k * 0.08}s` }}>
                            <em aria-hidden>{t.emoji}</em>
                            <b>{t.q}</b>
                            <small>{t.hint}</small>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="sa-chips">
                        {m.suggestions.map((s, k) => (
                          <button key={s} type="button" onClick={() => void send(s)} className="sa-chip" style={{ animationDelay: `${k * 0.07}s` }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )
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
            className="sa-form"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={contextPlace ? `Ask more about ${contextPlace}…` : "Ask about a trip, a place, or the app…"}
              className="sa-input"
              disabled={sending}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send" className="sa-send">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Avatar({ busy }: { busy?: boolean }) {
  return (
    <span className={`sa-av sa-owl ${busy ? "is-busy" : ""}`} aria-hidden>
      <Owl />
    </span>
  );
}

/** An assistant reply; the newest one is revealed word by word, like Pip is speaking. */
function Reply({ text, animate, onGrow, onDone }: { text: string; animate: boolean; onGrow: () => void; onDone: () => void }) {
  const [n, setN] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setN(text.length);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      onDone();
      return;
    }
    const total = text.length;
    const dur = Math.min(1900, Math.max(500, total * 13));
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.floor(total * p));
      onGrow();
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);

  let shown = text;
  if (n < text.length) {
    shown = text.slice(0, n);
    const sp = shown.lastIndexOf(" ");
    if (sp > 0) shown = shown.slice(0, sp); // never show half a word
    if (((shown.match(/\*\*/g) || []).length) % 2 === 1) shown += "**"; // never show a dangling bold marker
  }
  return (
    <>
      <FormattedText text={shown} />
      {n < text.length && <span className="sa-caret" aria-hidden />}
    </>
  );
}

// Replies use light markup (**bold**, "- " bullets, `code`) — render it as
// real bold text and tidy bullet rows instead of showing the raw symbols.
function FormattedText({ text }: { text: string }) {
  const lines = text.replace(/`/g, "").split("\n");
  return (
    <div className="sa-text">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const bullet = line.startsWith("- ");
        const body = bullet ? line.slice(2) : line;
        return (
          <div key={i} className={bullet ? "sa-li" : undefined}>
            {bullet && <span aria-hidden className="sa-bullet" />}
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

function replaceLast(messages: ChatMessage[], patch: Partial<ChatMessage>): ChatMessage[] {
  const copy = [...messages];
  copy[copy.length - 1] = { ...copy[copy.length - 1], role: "assistant", ...patch };
  return copy;
}

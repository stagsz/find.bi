/**
 * ChatPanel - Collapsible right sidebar for conversational AI chat with Ralph.
 *
 * Features:
 * - Message bubbles (user right-aligned, Ralph left-aligned)
 * - Conversation history maintained per session in state
 * - Input field at bottom with Enter to send
 * - Ralph avatar with personality
 * - Loading state with quirky phrases
 * - Error display
 * - Clear history button
 * - Retro-futuristic amber-on-dark aesthetic
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/services/api";

// ─── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string | null;
  plot_spec?: Record<string, unknown> | null;
}

interface ChatApiResponse {
  text: string;
  sql: string | null;
  plot_spec: Record<string, unknown> | null;
}

interface ChatPanelProps {
  workspaceId: string | null;
  open: boolean;
  onToggle: () => void;
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const LOADING_PHRASES = [
  "Ralph is thinking with his brain...",
  "The leprechaun told me to wait...",
  "My cat's breath smells like cat food...",
  "I'm learnding!",
  "The doctor said I wouldn't have so many nosebleeds if I kept my finger outta there...",
];

function pickLoadingPhrase(): string {
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
}

let nextMessageId = 0;
function generateId(): string {
  return `msg-${++nextMessageId}`;
}

// ─── Component ──────────────────────────────────────────────────────

function ChatPanel({ workspaceId, open, onToggle, className }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !workspaceId) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setError(null);

    // Build history for API (exclude the message we're about to send)
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await api.post<ChatApiResponse>("/api/ai/chat", {
        message: trimmed,
        workspace_id: workspaceId,
        history,
      });

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: res.data.text,
        sql: res.data.sql,
        plot_spec: res.data.plot_spec,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      if (
        err !== null &&
        typeof err === "object" &&
        "response" in err &&
        err.response !== null &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data !== null &&
        typeof err.response.data === "object" &&
        "detail" in err.response.data &&
        typeof err.response.data.detail === "string"
      ) {
        setError(err.response.data.detail);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to get response",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, workspaceId, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // ─── Toggle button (always visible) ────────────────────────────────

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        data-testid="chat-toggle-button"
        aria-label="Open chat"
        className={`fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[#F5A623]/40 bg-[#141414] shadow-lg shadow-[#F5A623]/10 transition-all hover:border-[#F5A623]/70 hover:bg-[#1C1C1C] hover:shadow-[#F5A623]/20 ${className ?? ""}`}
      >
        <svg
          className="h-5 w-5 text-[#F5A623]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  // ─── Open panel ─────────────────────────────────────────────────────

  return (
    <div
      data-testid="chat-panel"
      className={`flex h-full w-80 flex-col border-l border-[#2A2A2A] bg-[#0F0F0F] ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Ralph avatar */}
          <div
            data-testid="ralph-avatar"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5A623]/15 font-mono text-xs font-bold text-[#F5A623]"
          >
            R
          </div>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F5A623]">
            Ask Ralph
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              data-testid="chat-clear-button"
              aria-label="Clear chat"
              className="rounded p-1.5 text-[#6B6860] transition-colors hover:bg-[#1C1C1C] hover:text-[#A09D93]"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            data-testid="chat-close-button"
            aria-label="Close chat"
            className="rounded p-1.5 text-[#6B6860] transition-colors hover:bg-[#1C1C1C] hover:text-[#A09D93]"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        data-testid="chat-messages"
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
      >
        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div
            data-testid="chat-empty"
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5A623]/10">
              <span className="font-mono text-lg font-bold text-[#F5A623]">
                R
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-[#F0EDE4]">
                Hi! I&apos;m Ralph.
              </p>
              <p className="mt-1 text-xs text-[#6B6860]">
                Ask me anything about your data.
              </p>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-testid={`chat-message-${msg.role}`}
            className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar (Ralph only) */}
            {msg.role === "assistant" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5A623]/15 font-mono text-[0.6rem] font-bold text-[#F5A623]">
                R
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === "user"
                  ? "bg-[#F5A623]/15 text-[#F0EDE4]"
                  : "border border-[#2A2A2A] bg-[#141414] text-[#F0EDE4]"
              }`}
            >
              <p className="whitespace-pre-wrap text-[0.8rem] leading-relaxed">
                {msg.content}
              </p>

              {/* SQL block */}
              {msg.sql && (
                <div
                  data-testid="chat-message-sql"
                  className="mt-2 rounded border border-[#2A2A2A] bg-[#0F0F0F] p-2"
                >
                  <div className="mb-1 font-mono text-[0.6rem] uppercase tracking-wider text-[#6B6860]">
                    SQL
                  </div>
                  <pre className="overflow-x-auto font-mono text-[0.7rem] leading-relaxed text-[#F5A623]">
                    {msg.sql}
                  </pre>
                </div>
              )}

              {/* Plot spec indicator */}
              {msg.plot_spec && (
                <div
                  data-testid="chat-message-chart"
                  className="mt-2 flex items-center gap-1.5 rounded border border-[#F5A623]/20 bg-[#F5A623]/5 px-2 py-1.5"
                >
                  <svg
                    className="h-3 w-3 text-[#F5A623]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span className="font-mono text-[0.65rem] text-[#F5A623]">
                    Chart attached
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div
            data-testid="chat-loading"
            className="flex gap-2"
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5A623]/15 font-mono text-[0.6rem] font-bold text-[#F5A623]">
              R
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#141414] px-3 py-2">
              <svg
                className="h-3.5 w-3.5 animate-spin text-[#F5A623]"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-[0.75rem] text-[#6B6860]">
                {pickLoadingPhrase()}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            data-testid="chat-error"
            className="rounded-md border border-[#E84393]/30 bg-[#E84393]/10 px-3 py-2"
          >
            <p className="text-xs text-[#E84393]">{error}</p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#2A2A2A] px-3 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Ralph..."
            disabled={loading || !workspaceId}
            data-testid="chat-input"
            className="flex-1 rounded-md border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-sm text-[#F0EDE4] placeholder-[#6B6860] focus:border-[#F5A623]/50 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/30 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim() || !workspaceId}
            data-testid="chat-send-button"
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#F5A623]/40 bg-[#F5A623]/10 text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 disabled:opacity-40"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ChatPanelProps, ChatMessage };
export default ChatPanel;

/**
 * TranscriptPanel - Rolling voice interaction history.
 *
 * Slide-in panel showing all past voice interactions:
 *   - Relative timestamp
 *   - User speech (amber label)
 *   - Ralph response (muted label)
 *   - Per-entry copy and re-run actions (visible on hover)
 *   - Search input filtering by speech or response text
 *   - Clear all history button
 *
 * Aesthetic: retro-futuristic editorial, amber-on-dark, monospace labels.
 */

import { useState, useMemo, useCallback } from "react";
import type { TranscriptEntry } from "@/hooks/useVoiceHistory";

// ─── Utilities ──────────────────────────────────────────────────────

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ─── Inline SVG Icons ───────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RerunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function MicEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="1" width="6" height="11" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

// ─── Props ───────────────────────────────────────────────────────────

export interface TranscriptPanelProps {
  open: boolean;
  onClose: () => void;
  entries: TranscriptEntry[];
  onClearHistory: () => void;
  onRerun?: (query: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────

function TranscriptPanel({
  open,
  onClose,
  entries,
  onClearHistory,
  onRerun,
}: TranscriptPanelProps) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.userSpeech.toLowerCase().includes(q) ||
        e.ralphResponse.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const handleCopy = useCallback((entry: TranscriptEntry) => {
    const text = `You: ${entry.userSpeech}\n\nRalph: ${entry.ralphResponse}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500);
    });
  }, []);

  if (!open) return null;

  return (
    <div
      data-testid="transcript-panel"
      className="flex h-full w-72 flex-shrink-0 flex-col border-l border-[#2A2A2A] bg-[#0D0D0D]"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] uppercase tracking-widest text-[#F5A623]">
            Voice History
          </span>
          {entries.length > 0 && (
            <span
              data-testid="transcript-count"
              className="rounded bg-[#F5A623]/10 px-1.5 py-0.5 font-mono text-[0.55rem] tabular-nums text-[#F5A623]/70"
            >
              {entries.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <button
              type="button"
              data-testid="transcript-clear"
              onClick={onClearHistory}
              aria-label="Clear voice history"
              title="Clear history"
              className="rounded p-1 text-[#6B6860] transition-colors hover:text-[#E84393]"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            data-testid="transcript-close"
            onClick={onClose}
            aria-label="Close transcript panel"
            className="rounded p-1 text-[#6B6860] transition-colors hover:text-[#F0EDE4]"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="border-b border-[#1A1A1A] px-3 py-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#6B6860]" />
          <input
            data-testid="transcript-search"
            type="text"
            placeholder="Search history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-[#2A2A2A] bg-[#141414] py-1.5 pl-7 pr-7 font-mono text-[0.7rem] text-[#F0EDE4] placeholder-[#3A3A3A] focus:border-[#F5A623]/40 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-[#6B6860] transition-colors hover:text-[#F0EDE4]"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── Entry list ── */}
      <div
        data-testid="transcript-entries"
        className="flex-1 overflow-y-auto"
      >
        {entries.length === 0 ? (
          /* Empty state — no history yet */
          <div
            data-testid="transcript-empty"
            className="flex flex-col items-center justify-center px-4 py-12 text-center"
          >
            <MicEmptyIcon className="mb-3 h-8 w-8 text-[#232323]" />
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-[#2A2A2A]">
              No voice history yet
            </p>
            <p className="mt-1 text-[0.6rem] text-[#232323]">
              Say "Hey Ralph" or use push-to-talk
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* Search produced no matches */
          <div
            data-testid="transcript-no-results"
            className="flex flex-col items-center justify-center px-4 py-8 text-center"
          >
            <p className="font-mono text-[0.65rem] uppercase tracking-wider text-[#3A3A3A]">
              No matches
            </p>
          </div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              data-testid="transcript-entry"
              className="group border-b border-[#141414] px-3 py-3 last:border-b-0 hover:bg-[#111111]"
            >
              {/* Timestamp + hover actions */}
              <div className="mb-2 flex items-center justify-between">
                <span
                  data-testid="transcript-timestamp"
                  className="font-mono text-[0.55rem] uppercase tracking-wider text-[#333333]"
                >
                  {relativeTime(entry.timestamp)}
                </span>

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {onRerun && (
                    <button
                      type="button"
                      data-testid="transcript-rerun"
                      onClick={() => onRerun(entry.userSpeech)}
                      aria-label="Re-run this query"
                      title="Re-run"
                      className="rounded p-1 text-[#6B6860] transition-colors hover:text-[#F5A623]"
                    >
                      <RerunIcon className="h-3 w-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="transcript-copy"
                    onClick={() => handleCopy(entry)}
                    aria-label="Copy exchange"
                    title="Copy"
                    className="rounded p-1 text-[#6B6860] transition-colors hover:text-[#F5A623]"
                  >
                    {copiedId === entry.id ? (
                      <CheckIcon className="h-3 w-3 text-[#F5A623]" />
                    ) : (
                      <CopyIcon className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* User speech */}
              <div className="mb-2">
                <p className="mb-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-[#F5A623]/50">
                  You
                </p>
                <p className="text-[0.72rem] leading-snug text-[#F0EDE4]">
                  {entry.userSpeech}
                </p>
              </div>

              {/* Ralph response */}
              <div>
                <p className="mb-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-[#6B6860]">
                  Ralph
                </p>
                <p className="line-clamp-3 text-[0.72rem] leading-snug text-[#9B9890]">
                  {entry.ralphResponse}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TranscriptPanel;

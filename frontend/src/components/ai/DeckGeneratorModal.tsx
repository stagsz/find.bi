/**
 * DeckGeneratorModal — one-click trigger for AI analysis deck generation.
 *
 * Opens a modal overlay where the user can optionally provide a focus prompt
 * ("What should Ralph analyze?"), then generates an analysis deck via
 * POST /api/deck. Shows generation progress with Ralph personality,
 * then opens the DeckViewer with the result.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/services/api";
import DeckViewer from "./DeckViewer";
import type { Deck } from "./DeckViewer";

// ─── Types ──────────────────────────────────────────────────────────

type ModalPhase = "prompt" | "generating" | "viewing" | "error";

interface DeckGeneratorModalProps {
  workspaceId: string | null;
  open: boolean;
  onClose: () => void;
}

// ─── Ralph loading phrases ──────────────────────────────────────────

const LOADING_PHRASES = [
  "I made something with my brain!",
  "My cat's breath smells like cat food...",
  "The numbers taste like burning",
  "Ralph is connecting the dots...",
  "Unpacking the data suitcase...",
];

function pickLoadingPhrase(): string {
  return LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];
}

// ─── Component ──────────────────────────────────────────────────────

function DeckGeneratorModal({
  workspaceId,
  open,
  onClose,
}: DeckGeneratorModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("prompt");
  const [userGoal, setUserGoal] = useState("");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhrase] = useState(pickLoadingPhrase);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens in prompt phase
  useEffect(() => {
    if (open && phase === "prompt") {
      // Slight delay to ensure the modal is rendered
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, phase]);

  // Escape key to close — only in prompt/error phases (DeckViewer handles its own)
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && (phase === "prompt" || phase === "error")) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, phase, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setPhase("prompt");
      setUserGoal("");
      setDeck(null);
      setError(null);
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    if (!workspaceId) return;

    setPhase("generating");
    setError(null);

    try {
      const res = await api.post<Deck>("/api/deck", {
        workspace_id: workspaceId,
        user_goal: userGoal.trim() || "",
      });
      setDeck(res.data);
      setPhase("viewing");
    } catch (err: unknown) {
      let message = "Failed to generate deck";
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
        message = err.response.data.detail;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setPhase("error");
    }
  }, [workspaceId, userGoal]);

  const handleRetry = useCallback(() => {
    setPhase("prompt");
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && phase === "prompt") {
        e.preventDefault();
        handleGenerate();
      }
    },
    [phase, handleGenerate],
  );

  if (!open) return null;

  return (
    <div
      data-testid="deck-generator-modal"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        data-testid="deck-generator-backdrop"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={phase === "prompt" || phase === "error" ? onClose : undefined}
      />

      {/* ─── Prompt phase ─────────────────────────────────────────── */}
      {phase === "prompt" && (
        <div
          data-testid="deck-generator-prompt"
          className="relative z-10 w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-6 shadow-2xl shadow-black/50"
        >
          {/* Header */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#F5A623]/15">
              <svg
                className="h-4 w-4 text-[#F5A623]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F5A623]">
                Generate Analysis Deck
              </h2>
              <p className="mt-0.5 text-[0.7rem] text-[#6B6860]">
                Ralph will analyze your data and create a presentation
              </p>
            </div>
          </div>

          {/* Focus prompt input */}
          <label
            htmlFor="deck-goal-input"
            className="mb-1.5 block font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-[#A09D93]"
          >
            What should Ralph analyze?
            <span className="ml-1.5 font-normal normal-case tracking-normal text-[#6B6860]">
              (optional)
            </span>
          </label>
          <input
            ref={inputRef}
            id="deck-goal-input"
            data-testid="deck-goal-input"
            type="text"
            value={userGoal}
            onChange={(e) => setUserGoal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Focus on revenue trends by region"
            className="w-full rounded border border-[#2A2A2A] bg-[#141414] px-3 py-2 font-mono text-sm text-[#F0EDE4] placeholder-[#6B6860]/60 transition-colors focus:border-[#F5A623]/50 focus:outline-none focus:ring-1 focus:ring-[#F5A623]/30"
          />

          {/* Actions */}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="deck-cancel-button"
              onClick={onClose}
              className="rounded px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:text-[#A09D93]"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="deck-generate-button"
              onClick={() => void handleGenerate()}
              disabled={!workspaceId}
              className="inline-flex items-center gap-1.5 rounded border border-[#F5A623]/40 bg-[#F5A623]/10 px-4 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 hover:text-[#FFB84D] disabled:opacity-40"
            >
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Generate
            </button>
          </div>
        </div>
      )}

      {/* ─── Generating phase ──────────────────────────────────────── */}
      {phase === "generating" && (
        <div
          data-testid="deck-generator-loading"
          className="relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-8 shadow-2xl shadow-black/50"
        >
          {/* Pulsing deck icon */}
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-lg bg-[#F5A623]/15">
            <svg
              className="h-6 w-6 text-[#F5A623]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>

          {/* Spinner */}
          <svg
            className="h-5 w-5 animate-spin text-[#F5A623]"
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

          <div className="text-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F5A623]">
              Generating Deck...
            </p>
            <p className="mt-1 text-[0.7rem] text-[#6B6860]">
              {loadingPhrase}
            </p>
          </div>
        </div>
      )}

      {/* ─── Viewing phase (DeckViewer) ────────────────────────────── */}
      {phase === "viewing" && deck && (
        <div
          data-testid="deck-generator-viewer"
          className="relative z-10 h-[85vh] w-full max-w-4xl"
        >
          <DeckViewer
            deck={deck}
            onClose={onClose}
            className="h-full w-full"
          />
        </div>
      )}

      {/* ─── Error phase ───────────────────────────────────────────── */}
      {phase === "error" && (
        <div
          data-testid="deck-generator-error"
          className="relative z-10 w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-6 shadow-2xl shadow-black/50"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#E84393]/15">
              <svg
                className="h-4 w-4 text-[#E84393]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-[#E84393]">
              Generation Failed
            </h2>
          </div>

          <div className="rounded-md border border-[#E84393]/20 bg-[#E84393]/5 p-3">
            <p className="text-[0.8rem] text-[#E84393]">{error}</p>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="deck-error-close-button"
              onClick={onClose}
              className="rounded px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:text-[#A09D93]"
            >
              Close
            </button>
            <button
              type="button"
              data-testid="deck-retry-button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 rounded border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-[#F5A623] transition-colors hover:bg-[#F5A623]/20 hover:text-[#FFB84D]"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type { DeckGeneratorModalProps };
export default DeckGeneratorModal;

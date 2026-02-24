/**
 * DeckViewer — slide-based presentation view for AI-generated analysis decks.
 *
 * Features:
 * - Slide-by-slide navigation (prev/next arrows, keyboard shortcuts)
 * - Each slide renders title, narrative text, and optional Observable Plot chart
 * - Slide counter ("2 / 6")
 * - Fullscreen mode (Escape to exit)
 * - Rich text rendering (**bold**, *italic*, `code`)
 * - Retro-futuristic amber-on-dark editorial aesthetic
 */

import { useCallback, useEffect, useRef, useState } from "react";
import PlotRenderer from "@/components/explore/PlotRenderer";
import type { PlotSpec } from "@/components/explore/PlotRenderer";

// ─── Types ──────────────────────────────────────────────────────────

interface DeckSlide {
  title: string;
  narrative: string;
  plot_spec: Record<string, unknown> | null;
}

interface Deck {
  deck_title: string;
  summary: string;
  slides: DeckSlide[];
}

interface DeckViewerProps {
  deck: Deck;
  onClose?: () => void;
  className?: string;
}

// ─── Rich Text Renderer ─────────────────────────────────────────────

/**
 * Parse basic markdown in narrative text: `code`, **bold**, *italic*.
 * Returns an array of React nodes for inline rendering.
 */
function renderNarrative(text: string): React.ReactNode[] {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    if (match[1]) {
      nodes.push(
        <code
          key={++key}
          className="rounded bg-[#F5A623]/10 px-1 py-0.5 font-mono text-[0.8rem] text-[#F5A623]"
        >
          {full.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(
        <strong key={++key} className="font-semibold text-[#F0EDE4]">
          {full.slice(2, -2)}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <em key={++key} className="italic text-[#A09D93]">
          {full.slice(1, -1)}
        </em>,
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

// ─── Component ──────────────────────────────────────────────────────

function DeckViewer({ deck, onClose, className }: DeckViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSlides = deck.slides.length;
  const slide = deck.slides[currentSlide];

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may not be available in all environments
    }
  }, []);

  // Sync fullscreen state with browser events
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape" && !document.fullscreenElement) {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrev, onClose]);

  if (totalSlides === 0) {
    return (
      <div
        data-testid="deck-viewer"
        className={`flex items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] p-12 ${className ?? ""}`}
      >
        <p className="font-mono text-sm text-[#6B6860]">
          No slides in this deck.
        </p>
      </div>
    );
  }

  // Split narrative into paragraphs for rendering
  const paragraphs = slide.narrative
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div
      ref={containerRef}
      data-testid="deck-viewer"
      className={`flex flex-col overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#0F0F0F] ${
        isFullscreen ? "h-screen w-screen" : ""
      } ${className ?? ""}`}
    >
      {/* ─── Header bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Deck icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#F5A623]/15">
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
          <h2
            data-testid="deck-title"
            className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F5A623]"
          >
            {deck.deck_title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Fullscreen toggle */}
          <button
            type="button"
            data-testid="deck-fullscreen-button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="rounded p-1.5 text-[#6B6860] transition-colors hover:bg-[#1C1C1C] hover:text-[#A09D93]"
          >
            {isFullscreen ? (
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
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
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
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            )}
          </button>
          {/* Close button */}
          {onClose && (
            <button
              type="button"
              data-testid="deck-close-button"
              onClick={onClose}
              aria-label="Close deck"
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
          )}
        </div>
      </div>

      {/* ─── Slide content ──────────────────────────────────────────── */}
      <div
        data-testid="deck-slide-content"
        className="flex flex-1 flex-col overflow-y-auto px-6 py-6"
      >
        {/* Slide number label */}
        <span className="mb-4 inline-block self-start rounded bg-[#F5A623]/10 px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-widest text-[#F5A623]">
          Slide {currentSlide + 1}
        </span>

        {/* Slide title */}
        <h3
          data-testid="deck-slide-title"
          className="mb-4 text-lg font-semibold leading-snug text-[#F0EDE4]"
        >
          {slide.title}
        </h3>

        {/* Narrative paragraphs */}
        <div data-testid="deck-slide-narrative" className="mb-5 space-y-3">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-[0.85rem] leading-relaxed text-[#A09D93]"
            >
              {renderNarrative(para)}
            </p>
          ))}
        </div>

        {/* Observable Plot chart */}
        {slide.plot_spec && (
          <div
            data-testid="deck-slide-chart"
            className="overflow-hidden rounded border border-[#F5A623]/20 bg-[#0F0F0F]"
          >
            <PlotRenderer
              spec={slide.plot_spec as unknown as PlotSpec}
              className="w-full"
              style={{ background: "#0F0F0F" }}
            />
          </div>
        )}
      </div>

      {/* ─── Navigation footer ──────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-[#2A2A2A] px-4 py-3">
        {/* Previous button */}
        <button
          type="button"
          data-testid="deck-prev-button"
          onClick={goPrev}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:bg-[#1C1C1C] hover:text-[#A09D93] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6B6860]"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Prev
        </button>

        {/* Slide counter */}
        <span
          data-testid="deck-slide-counter"
          className="font-mono text-[0.7rem] tracking-wider text-[#6B6860]"
        >
          {currentSlide + 1} / {totalSlides}
        </span>

        {/* Next button */}
        <button
          type="button"
          data-testid="deck-next-button"
          onClick={goNext}
          disabled={currentSlide === totalSlides - 1}
          aria-label="Next slide"
          className="flex items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-[#6B6860] transition-colors hover:bg-[#1C1C1C] hover:text-[#A09D93] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6B6860]"
        >
          Next
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
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export type { Deck, DeckSlide, DeckViewerProps };
export default DeckViewer;

/**
 * useHighlightAnimation hook for real-time update highlighting.
 *
 * Manages a set of highlighted IDs that automatically clear after a duration.
 * Useful for showing flash animations when entries are created/updated/deleted.
 *
 * @module hooks/useHighlightAnimation
 */

import { useCallback, useState, useRef, useEffect } from 'react';

/**
 * Animation type for different update scenarios.
 */
export type AnimationType = 'created' | 'updated' | 'deleted' | 'risk';

/**
 * Highlighted item with animation metadata.
 */
interface HighlightedItem {
  /** Item ID */
  id: string;
  /** Animation type */
  type: AnimationType;
  /** Timestamp when highlight was triggered */
  timestamp: number;
}

/**
 * Return type for useHighlightAnimation hook.
 */
interface UseHighlightAnimationReturn {
  /** Set of highlighted item IDs by type */
  highlightedIds: Map<string, AnimationType>;
  /** Trigger highlight for an item */
  highlight: (id: string, type?: AnimationType) => void;
  /** Trigger highlight for multiple items */
  highlightMany: (ids: string[], type?: AnimationType) => void;
  /** Manually clear a highlight */
  clear: (id: string) => void;
  /** Clear all highlights */
  clearAll: () => void;
  /** Check if an item is highlighted */
  isHighlighted: (id: string) => boolean;
  /** Get animation type for an item */
  getAnimationType: (id: string) => AnimationType | undefined;
}

/**
 * Default animation duration in milliseconds.
 */
const DEFAULT_DURATION = 1500;

/**
 * Hook for managing highlight animations on data items.
 *
 * @param duration - How long the highlight should last (ms)
 * @returns Highlight state and control functions
 *
 * @example
 * ```tsx
 * const { highlightedIds, highlight, isHighlighted, getAnimationType } = useHighlightAnimation(1000);
 *
 * // When entry is created by another user
 * useEffect(() => {
 *   onEntryCreated: (payload) => highlight(payload.entry.id, 'created'),
 *   onEntryUpdated: (payload) => highlight(payload.entryId, 'updated'),
 *   onEntryDeleted: (payload) => highlight(payload.entryId, 'deleted'),
 * }, [highlight]);
 *
 * // In render
 * <TableRow className={isHighlighted(entry.id) ? `animate-${getAnimationType(entry.id)}` : ''}>
 * ```
 */
export function useHighlightAnimation(
  duration: number = DEFAULT_DURATION
): UseHighlightAnimationReturn {
  // Map of id -> animation type
  const [highlighted, setHighlighted] = useState<Map<string, AnimationType>>(
    new Map()
  );

  // Track timeouts for cleanup
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  /**
   * Clear a specific highlight and its timeout.
   */
  const clear = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }

    // Remove from highlighted set
    setHighlighted((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /**
   * Trigger highlight for an item.
   */
  const highlight = useCallback(
    (id: string, type: AnimationType = 'updated') => {
      // Clear any existing timeout for this id
      const existingTimeout = timeoutsRef.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Add to highlighted set
      setHighlighted((prev) => {
        const next = new Map(prev);
        next.set(id, type);
        return next;
      });

      // Set timeout to remove highlight
      const timeout = setTimeout(() => {
        timeoutsRef.current.delete(id);
        setHighlighted((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }, duration);

      timeoutsRef.current.set(id, timeout);
    },
    [duration]
  );

  /**
   * Trigger highlight for multiple items.
   */
  const highlightMany = useCallback(
    (ids: string[], type: AnimationType = 'updated') => {
      ids.forEach((id) => highlight(id, type));
    },
    [highlight]
  );

  /**
   * Clear all highlights.
   */
  const clearAll = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();

    // Clear all highlights
    setHighlighted(new Map());
  }, []);

  /**
   * Check if an item is highlighted.
   */
  const isHighlighted = useCallback(
    (id: string): boolean => highlighted.has(id),
    [highlighted]
  );

  /**
   * Get animation type for an item.
   */
  const getAnimationType = useCallback(
    (id: string): AnimationType | undefined => highlighted.get(id),
    [highlighted]
  );

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    highlightedIds: highlighted,
    highlight,
    highlightMany,
    clear,
    clearAll,
    isHighlighted,
    getAnimationType,
  };
}

export default useHighlightAnimation;

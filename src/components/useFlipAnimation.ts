import { useCallback, useLayoutEffect, useRef } from 'react';

type Position = Pick<DOMRect, 'left' | 'top'>;

const FLIP_DURATION_MS = 280;
const FLIP_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/**
 * FLIP animation for keyed list items.
 * Call captureFirst() immediately before changing item order; the layout effect
 * measures the Last positions after React commits, applies the Invert offset,
 * then plays each item back to its natural position with the Web Animations API.
 */
export function useFlipAnimation<T extends HTMLElement>(orderKey: string) {
  const listRef = useRef<T | null>(null);
  const firstPositionsRef = useRef<Map<string, Position> | null>(null);
  const clearSnapshotTimerRef = useRef<number | null>(null);
  const animationsRef = useRef(new WeakMap<HTMLElement, Animation>());

  const captureFirst = useCallback(() => {
    const list = listRef.current;
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const first = new Map<string, Position>();
    list.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((item) => {
      const id = item.dataset.flipId;
      if (!id) return;
      const rect = item.getBoundingClientRect();
      first.set(id, { left: rect.left, top: rect.top });
    });

    if (!first.size) return;
    firstPositionsRef.current = first;
    if (clearSnapshotTimerRef.current !== null)
      window.clearTimeout(clearSnapshotTimerRef.current);
    // A no-op reorder must not leave a stale snapshot for a later unrelated render.
    clearSnapshotTimerRef.current = window.setTimeout(() => {
      firstPositionsRef.current = null;
      clearSnapshotTimerRef.current = null;
    }, 1000);
  }, []);

  useLayoutEffect(() => {
    const first = firstPositionsRef.current;
    firstPositionsRef.current = null;
    if (clearSnapshotTimerRef.current !== null) {
      window.clearTimeout(clearSnapshotTimerRef.current);
      clearSnapshotTimerRef.current = null;
    }
    if (!first || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const list = listRef.current;
    if (!list) return;

    list.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((item) => {
      const id = item.dataset.flipId;
      const before = id ? first.get(id) : undefined;
      if (!before) return;

      const after = item.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      // If another move starts before the previous FLIP finishes, replace it cleanly.
      animationsRef.current.get(item)?.cancel();
      const animation = item.animate(
        [
          { transform: `translate3d(${dx}px, ${dy}px, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        { duration: FLIP_DURATION_MS, easing: FLIP_EASING },
      );
      animationsRef.current.set(item, animation);
      animation.addEventListener('finish', () => {
        if (animationsRef.current.get(item) === animation) animationsRef.current.delete(item);
      }, { once: true });
      animation.addEventListener('cancel', () => {
        if (animationsRef.current.get(item) === animation) animationsRef.current.delete(item);
      }, { once: true });
    });
  }, [orderKey]);

  return { listRef, captureFirst };
}

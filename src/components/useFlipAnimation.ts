import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

type Position = Pick<DOMRect, 'left' | 'top'>;
type Move = { item: HTMLElement; dx: number; dy: number; distanceToViewportCenter: number };

const DESKTOP_DURATION_MS = 280;
const MOBILE_DURATION_MS = 190;
const DESKTOP_MAX_ITEMS = 16;
const MOBILE_MAX_ITEMS = 8;
const SCROLL_IDLE_MS = 140;
const FLIP_EASING = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/**
 * FLIP animation for keyed list items.
 * Measures only the list's visible items and keeps a small animation budget,
 * especially on touch devices. Any scroll cancels running FLIP effects so they
 * do not compete with native scrolling or momentum on mobile.
 */
export function useFlipAnimation<T extends HTMLElement>(orderKey: string) {
  const listRef = useRef<T | null>(null);
  const firstPositionsRef = useRef<Map<string, Position> | null>(null);
  const clearSnapshotTimerRef = useRef<number | null>(null);
  const lastScrollAtRef = useRef(Number.NEGATIVE_INFINITY);
  const animationsRef = useRef(new Set<Animation>());
  const visibleItemsRef = useRef(new Set<HTMLElement>());

  const cancelAnimations = useCallback(() => {
    animationsRef.current.forEach((animation) => animation.cancel());
    animationsRef.current.clear();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      lastScrollAtRef.current = performance.now();
      firstPositionsRef.current = null;
      if (clearSnapshotTimerRef.current !== null) {
        window.clearTimeout(clearSnapshotTimerRef.current);
        clearSnapshotTimerRef.current = null;
      }
      cancelAnimations();
    };

    // Capture observes nested scroll containers as well as window scrolling.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      cancelAnimations();
      if (clearSnapshotTimerRef.current !== null)
        window.clearTimeout(clearSnapshotTimerRef.current);
    };
  }, [cancelAnimations]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const observedItems = new Set<HTMLElement>();
    const visibleItems = visibleItemsRef.current;
    visibleItems.clear();

    if (typeof IntersectionObserver === 'undefined') {
      list.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((item) => {
        observedItems.add(item);
        visibleItems.add(item);
      });
      return () => {
        observedItems.clear();
        visibleItems.clear();
      };
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) visibleItems.add(target as HTMLElement);
        else visibleItems.delete(target as HTMLElement);
      });
    });
    const observeNode = (node: Node) => {
      if (!(node instanceof HTMLElement)) return;
      const items: HTMLElement[] = [];
      if (node.matches('[data-flip-id]')) items.push(node);
      items.push(...node.querySelectorAll<HTMLElement>('[data-flip-id]'));
      items.forEach((item) => {
        if (observedItems.has(item)) return;
        observedItems.add(item);
        observer.observe(item);
      });
    };
    list.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((item) => observeNode(item));

    const mutations = new MutationObserver((records) => {
      records.forEach(({ addedNodes, removedNodes }) => {
        removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          const items: HTMLElement[] = [];
          if (node.matches('[data-flip-id]')) items.push(node);
          items.push(...node.querySelectorAll<HTMLElement>('[data-flip-id]'));
          items.forEach((item) => {
            if (list.contains(item)) return; // A keyed reorder moved, rather than removed, the node.
            observer.unobserve(item);
            observedItems.delete(item);
            visibleItems.delete(item);
          });
        });
        addedNodes.forEach(observeNode);
      });
    });
    mutations.observe(list, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
      observedItems.clear();
      visibleItems.clear();
    };
  }, []);

  const captureFirst = useCallback(() => {
    const list = listRef.current;
    if (
      !list ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      performance.now() - lastScrollAtRef.current < SCROLL_IDLE_MS
    ) return;

    const first = new Map<string, Position>();
    const listRect = list.getBoundingClientRect();
    const viewportTop = Math.max(0, listRect.top);
    const viewportBottom = Math.min(window.innerHeight, listRect.bottom);
    if (viewportBottom <= viewportTop) return;
    visibleItemsRef.current.forEach((item) => {
      if (!list.contains(item)) {
        visibleItemsRef.current.delete(item);
        return;
      }
      const id = item.dataset.flipId;
      if (!id) return;
      const rect = item.getBoundingClientRect();
      if (rect.bottom <= viewportTop || rect.top >= viewportBottom) return;
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
    if (
      !first ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      performance.now() - lastScrollAtRef.current < SCROLL_IDLE_MS
    ) return;

    const list = listRef.current;
    if (!list) return;

    const mobile = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    const maxItems = mobile ? MOBILE_MAX_ITEMS : DESKTOP_MAX_ITEMS;
    const listRect = list.getBoundingClientRect();
    const viewportTop = Math.max(0, listRect.top);
    const viewportBottom = Math.min(window.innerHeight, listRect.bottom);
    if (viewportBottom <= viewportTop) return;
    const viewportCenter = (viewportTop + viewportBottom) / 2;
    const moves: Move[] = [];

    visibleItemsRef.current.forEach((item) => {
      if (!list.contains(item)) {
        visibleItemsRef.current.delete(item);
        return;
      }
      const id = item.dataset.flipId;
      const before = id ? first.get(id) : undefined;
      if (!before) return;

      const after = item.getBoundingClientRect();
      // Offscreen rows stay in their new natural position and do no animation work.
      if (after.bottom <= viewportTop || after.top >= viewportBottom) return;

      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      moves.push({
        item,
        dx,
        dy,
        distanceToViewportCenter: Math.abs(after.top + after.height / 2 - viewportCenter),
      });
    });

    // Animate the nearest rows first; a bounded set prevents large lists from
    // creating dozens of simultaneous compositing layers on mobile GPUs.
    moves
      .sort((a, b) => a.distanceToViewportCenter - b.distanceToViewportCenter)
      .slice(0, maxItems)
      .forEach(({ item, dx, dy }) => {
        const animation = item.animate(
          [
            { transform: `translate3d(${dx}px, ${dy}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          {
            duration: mobile ? MOBILE_DURATION_MS : DESKTOP_DURATION_MS,
            easing: FLIP_EASING,
          },
        );
        animationsRef.current.add(animation);
        const remove = () => animationsRef.current.delete(animation);
        animation.addEventListener('finish', remove, { once: true });
        animation.addEventListener('cancel', remove, { once: true });
      });
  }, [orderKey]);

  return { listRef, captureFirst };
}

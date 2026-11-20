import { useSyncExternalStore } from 'react';

/* PLAY YOUR LIFE 2.0 — «Ближайшие» в левом меню «Нашей жизни»: два ближайших мероприятия общего календаря.
 * Сервисы публикуют список сюда, меню только читает его. */
export type UpcomingPerson = { name: string; photo?: string };
export type UpcomingItem = { id: string; title: string; start: string; place: string; icon: string; color: string; people: UpcomingPerson[] };
type Snapshot = { items: UpcomingItem[]; open: (id: string) => void };

let snapshot: Snapshot = { items: [], open: () => undefined };
const listeners = new Set<() => void>();

export function publishUpcoming(items: UpcomingItem[], open: (id: string) => void) {
  const same = items.length === snapshot.items.length && JSON.stringify(items) === JSON.stringify(snapshot.items);
  if (same && open === snapshot.open) return;
  snapshot = { items, open };
  listeners.forEach((l) => l());
}

export function useUpcoming(): Snapshot {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => snapshot, () => snapshot);
}

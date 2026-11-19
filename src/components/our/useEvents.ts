import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { dayKey, eventVisible, now, occurrences, watch } from '../../ourData';
import type { CalEvent, Ctx } from '../../ourData';
import { fmtIso } from './ourFormat';

/** Общие и свои личные события в реальном времени (две подписки — правила не дают читать чужие личные). */
export function useEvents(ctx: Ctx) {
  const [shared, setShared] = useState<CalEvent[]>([]);
  const [mine, setMine] = useState<CalEvent[]>([]);
  const [error, setError] = useState('');
  useEffect(() => watch<CalEvent>(ctx, 'events', [where('access', '==', 'shared')], setShared, setError), [ctx]);
  useEffect(() => watch<CalEvent>(ctx, 'events', [where('authorId', '==', ctx.uid), where('access', '==', 'personal')], setMine, setError), [ctx]);
  return { events: useMemo(() => [...shared, ...mine], [shared, mine]), error };
}

/** Напоминания о событиях, пока приложение открыто (ТЗ 6.9, 10.2): баннер в приложении и системное уведомление, если разрешено. */
export function useEventReminders(ctx: Ctx, events: CalEvent[], onRemind: (e: CalEvent) => void) {
  useEffect(() => {
    const fired = new Set<string>(JSON.parse(sessionStorage.getItem('our-reminded') ?? '[]') as string[]);
    const tick = () => {
      const t = now();
      for (const e of events) {
        if (e.status === 'cancelled' || !e.reminder || !eventVisible(e, ctx.uid, 'mine')) continue;
        for (const o of occurrences(e, dayKey(new Date(t - 86400000)), dayKey(new Date(t + 8 * 86400000)))) {
          const at = new Date(o.start).getTime() - e.reminder * 60000, key = `${e.id}@${o.start}`;
          if (t >= at && t < new Date(o.start).getTime() && !fired.has(key)) {
            fired.add(key); sessionStorage.setItem('our-reminded', JSON.stringify([...fired]));
            onRemind(e);
            try { if ('Notification' in window && Notification.permission === 'granted') new Notification(`Скоро: ${e.title}`, { body: fmtIso(o.start) }); } catch { /* системные уведомления недоступны */ }
          }
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [ctx.uid, events, onRemind]);
}


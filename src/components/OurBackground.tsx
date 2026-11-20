import { useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { where } from '../ourStore';
import { database } from '../firebaseClient';
import { accountStorage } from '../accountStorage';
import { forUser, isPairEmail, newId, notify, patch, put, watch, PAIR_SPACE_ID } from '../ourData';
import type { Ctx, Notice } from '../ourData';
import type { Space } from '../sharedSpace';
import { isFreshInbox, setPartner } from '../ourInbox';
import type { InboxItem } from '../ourInbox';
import { importSharedArticle, kbImportListeners, kbStorageKey, parseKnowledgeBase } from '../knowledgeBase';
import { ourRoute, isOurPage } from '../ourLife';
import { showSystemNotification } from '../systemNotify';

type Props = { userId: string; userEmail: string; userName: string; onAddTask: (title: string, day?: string) => boolean; onNotify: (text: string) => void };

/**
 * Фон «Нашей жизни» — работает на любой странице игры, пока пользователь вошёл:
 * задачи и статьи от второго участника попадают к себе, уведомления показываются системно.
 */
export default function OurBackground({ userId, userEmail, userName, onAddTask, onNotify }: Props) {
  const cb = useRef({ onAddTask, onNotify });
  useEffect(() => { cb.current = { onAddTask, onNotify }; }, [onAddTask, onNotify]);

  useEffect(() => {
    if (!isPairEmail(userEmail)) return;
    let ctx: Ctx | null = null;
    const offs: (() => void)[] = [];
    const seenKey = `pyl-our-notified:${userId}`;
    const taken = new Set<string>();
    const stop = onSnapshot(doc(database, 'spaces', PAIR_SPACE_ID), (snap) => {
      const data = snap.data() as Omit<Space, 'id'> | undefined;
      if (!data || !data.memberIds?.includes(userId) || ctx) return;
      const space = { id: PAIR_SPACE_ID, ...data } as Space;
      const c: Ctx = { db: database, space, uid: userId, name: userName.trim() || data.members?.[userId]?.name || 'Участник' };
      ctx = c;
      const partnerUid = space.memberIds.find((m) => m !== userId);
      const partnerName = partnerUid ? space.members[partnerUid]?.name ?? 'Партнёр' : '';
      if (partnerUid) setPartner({
        name: partnerName,
        send: async (d) => {
          await put(c, 'inbox', newId(c, 'inbox'), { ...d, title: d.title.slice(0, 200), to: partnerUid, status: 'new' });
          await notify(c, d.kind === 'task' ? `поставил(а) задачу «${d.title}»` : `поделился(ась) статьёй «${d.title}»`, { page: d.kind === 'task' ? 'tasks' : 'knowledge' });
        },
      });
      const fromName = (uid: string) => space.members[uid]?.name ?? 'Партнёр';
      // Входящие задачи и статьи.
      offs.push(watch<InboxItem>(c, 'inbox', [where('to', '==', userId), where('status', '==', 'new')], (rows) => {
        for (const item of rows) {
          if (!isFreshInbox(item, userId) || taken.has(item.id)) continue;
          taken.add(item.id);
          const from = fromName(item.authorId);
          if (item.kind === 'task') {
            const title = item.note ? `${item.title} — ${item.note}` : item.title;
            if (!cb.current.onAddTask(title, item.due)) { taken.delete(item.id); continue; }
            cb.current.onNotify(`${from} поставил(а) задачу: ${item.title}`);
            void showSystemNotification(`📌 ${from} поставил(а) задачу`, item.title, '#open=tasks', `inbox-${item.id}`);
          } else {
            const input = { title: item.title, html: item.html ?? '', from, icon: item.icon };
            if (kbImportListeners.size) kbImportListeners.forEach((l) => l(input));
            else {
              const key = kbStorageKey(userId);
              try { accountStorage.setItem(key, JSON.stringify(importSharedArticle(parseKnowledgeBase(accountStorage.getItem(key), []), input))); } catch { taken.delete(item.id); continue; }
            }
            cb.current.onNotify(`${from} поделился(ась) статьёй: ${item.title}`);
            void showSystemNotification(`📨 ${from} поделился(ась) статьёй`, item.title, '#open=knowledge', `inbox-${item.id}`);
          }
          void patch(c, 'inbox', item.id, { status: 'taken' }).catch(() => undefined);
        }
      }, () => undefined));
      // Уведомления «Нашей жизни» (сообщения, события, места, собрания) — системно, если игра свёрнута или открыт другой раздел.
      offs.push(watch<Notice>(c, 'notifications', forUser(userId), (rows) => {
        let seen = Number(localStorage.getItem(seenKey) ?? 0);
        if (!seen) { seen = Date.now(); localStorage.setItem(seenKey, String(seen)); }
        const fresh = rows.filter((n) => !n.read && n.at > seen).sort((a, b) => a.at - b.at);
        if (!fresh.length) return;
        localStorage.setItem(seenKey, String(fresh[fresh.length - 1].at));
        const away = document.visibilityState !== 'visible' || !location.hash.startsWith('#our/');
        if (!away) return;
        for (const n of fresh.slice(-3)) {
          const target = n.link?.page && isOurPage(n.link.page) ? ourRoute(n.link.page) : n.link?.page ? `#open=${n.link.page}` : '#our/chat';
          void showSystemNotification('Наша жизнь', n.text, target, `notice-${n.id}`);
        }
      }, () => undefined));
    }, () => setPartner(null));
    return () => { stop(); offs.forEach((o) => o()); setPartner(null); };
  }, [userId, userEmail, userName]);
  return null;
}

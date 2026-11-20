import { useSyncExternalStore } from 'react';

/* PLAY YOUR LIFE 2.0 — «передать партнёру»: задача или статья базы знаний для второго участника «Нашей жизни».
 * Запись кладётся в spaces/{id}/inbox; у получателя фоновый модуль добавляет её к себе и показывает уведомление. */
export type InboxKind = 'task' | 'article';
export type InboxItem = { id: string; authorId: string; to: string; at: number; kind: InboxKind; title: string; note?: string; due?: string; html?: string; icon?: string; status: 'new' | 'taken' };
export type InboxDraft = { kind: InboxKind; title: string; note?: string; due?: string; html?: string; icon?: string };

type Partner = { name: string; send: (draft: InboxDraft) => Promise<void> } | null;
let partner: Partner = null;
const listeners = new Set<() => void>();

export function setPartner(next: Partner) { partner = next; listeners.forEach((l) => l()); }
/** Второй участник «Нашей жизни» (если он есть и облако доступно) и отправка ему задачи или статьи. */
export function usePartner(): Partner {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => partner, () => partner);
}

/** Чистая проверка входящей записи: только новые, адресованные мне, с непустым заголовком. */
export function isFreshInbox(item: Partial<InboxItem>, uid: string): item is InboxItem {
  return item.to === uid && item.status === 'new' && typeof item.title === 'string' && item.title.trim().length > 0 && (item.kind === 'task' || item.kind === 'article');
}

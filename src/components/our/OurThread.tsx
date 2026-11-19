import { useEffect, useRef, useState } from 'react';
import { orderBy, limit } from 'firebase/firestore';
import { fileAttachment, newId, now, put, remove, watch } from '../../ourData';
import type { Attachment, Comment, Ctx } from '../../ourData';
import Ic from '../KbIcons';
import { AttachmentView, Avatar, Linkify } from './OurUi';
import { fmtDateTime, nameIn } from './ourFormat';

/**
 * Обсуждение конкретного объекта — мероприятия или места (ТЗ 6.7, 7.6): своё у каждого объекта,
 * хранится в `…/{объект}/comments`. Текст, фото, ссылки, ответы, автор и время.
 */
export default function OurThread({ ctx, path, onPosted, placeholder = 'Написать в обсуждение…' }: { ctx: Ctx; path: string; onPosted?: (text: string) => void; placeholder?: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [att, setAtt] = useState<Attachment | null>(null);
  const [reply, setReply] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const who = nameIn(ctx.space);
  useEffect(() => watch<Comment>(ctx, `${path}/comments`, [orderBy('at', 'asc'), limit(300)], setItems, setError), [ctx, path]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [items.length]);

  const send = async () => {
    if (!text.trim() && !att) return;
    setBusy(true);
    try {
      await put(ctx, `${path}/comments`, newId(ctx, `${path}/comments`), { text: text.trim().slice(0, 3000), attachment: att, replyTo: reply ? { id: reply.id, text: reply.text.slice(0, 120), authorId: reply.authorId } : null, at: now() });
      onPosted?.(text.trim() || 'фото');
      setText(''); setAtt(null); setReply(null); setError('');
    } catch { setError('Не удалось отправить. Проверьте интернет и повторите.'); } finally { setBusy(false); }
  };

  return (
    <div className="oth">
      {error && <p className="o-err">{error}</p>}
      <div className="oth-list">
        {items.length === 0 && <p className="o-muted">Пока никто ничего не написал.</p>}
        {items.map((c) => (
          <div key={c.id} className={`oth-item${c.authorId === ctx.uid ? ' mine' : ''}`}>
            <Avatar name={who(c.authorId)} me={c.authorId === ctx.uid} size={30} />
            <div>
              <div className="oth-meta"><strong>{who(c.authorId)}</strong><small>{fmtDateTime(c.at)}{c.pending ? ' · отправляется…' : ''}</small></div>
              {c.replyTo && <div className="o-quote">↩ {who(c.replyTo.authorId)}: {c.replyTo.text}</div>}
              {c.text && <p><Linkify text={c.text} /></p>}
              {c.attachment && <AttachmentView a={c.attachment} />}
              <div className="oth-actions">
                <button type="button" onClick={() => setReply(c)}>Ответить</button>
                {c.authorId === ctx.uid && <button type="button" onClick={() => { if (window.confirm('Удалить сообщение?')) void remove(ctx, `${path}/comments`, c.id); }}>Удалить</button>}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {reply && <div className="o-replybar">↩ Ответ {who(reply.authorId)}: {reply.text.slice(0, 80)} <button type="button" aria-label="Отменить ответ" onClick={() => setReply(null)}><Ic n="close" size={14} /></button></div>}
      {att && <div className="o-replybar">📎 {att.kind === 'image' ? 'Фото' : att.name} <button type="button" aria-label="Убрать вложение" onClick={() => setAtt(null)}><Ic n="close" size={14} /></button></div>}
      <form className="oth-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <button type="button" className="o-icon" aria-label="Прикрепить фото" title="Фото" onClick={() => fileRef.current?.click()}><Ic n="upload" size={18} /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setAtt(await fileAttachment(f)); } catch (er) { setError((er as Error).message); } }} />
        <textarea value={text} rows={1} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Сообщение" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <button type="submit" className="o-primary" disabled={busy || (!text.trim() && !att)}>Отправить</button>
      </form>
    </div>
  );
}

import { useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { initials } from './ourFormat';
import { OurPhotos } from './ourPhotos';
import type { Attachment } from '../../ourData';
import Ic from '../KbIcons';
import type { IconName } from '../KbIcons';

/* Общие мелочи интерфейса «Нашей жизни»: окно, аватар, вложение, даты. */


export function Avatar({ name, me = false, size = 34 }: { name: string; me?: boolean; size?: number }) {
  const photo = useContext(OurPhotos)[name];
  return <span className={`oa${me ? ' me' : ''}${photo ? ' photo' : ''}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{photo ? <img src={photo} alt="" draggable={false} /> : initials(name)}</span>;
}

export function Modal({ title, onClose, children, wide = false, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="om-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`om${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <header><h2>{title}</h2><button type="button" className="om-x" aria-label="Закрыть" onClick={onClose}><Ic n="close" size={20} /></button></header>
        <div className="om-body">{children}</div>
        {footer && <footer className="om-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`of${wide ? ' wide' : ''}`}><span>{label}</span>{children}</label>;
}

export function Tabs<T extends string>({ value, items, onChange }: { value: T; items: [T, string, number?][]; onChange: (v: T) => void }) {
  return (
    <div className="ot" role="tablist">
      {items.map(([id, label, count]) => <button key={id} type="button" role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}{count ? <em>{count}</em> : null}</button>)}
    </div>
  );
}

export function AttachmentView({ a }: { a: Attachment }) {
  if (a.kind === 'image') return <a href={a.data} target="_blank" rel="noreferrer" className="oatt-img"><img src={a.data} alt={a.name ?? 'Фото'} loading="lazy" /></a>;
  if (a.kind === 'voice') return <audio className="oatt-voice" controls src={a.data} preload="none" />;
  return <a className="oatt-file" href={a.data} download={a.name ?? 'файл'}><Ic n="file" size={18} /><span>{a.name ?? 'Файл'}</span>{a.size ? <small>{Math.round(a.size / 1000)} КБ</small> : null}</a>;
}

export function Empty({ icon = 'file', title, text }: { icon?: IconName; title: string; text?: string }) {
  return <div className="oe"><span aria-hidden="true"><Ic n={icon} size={28} /></span><strong>{title}</strong>{text && <p>{text}</p>}</div>;
}

/** Текст со ссылками: адреса http(s) становятся кликабельными. */
export function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a> : <span key={i}>{p}</span>))}</>;
}

/** Обсуждение объекта (событие, место): комментарии с фото, ответами и ссылками (ТЗ 6.7, 7.6). */
export type ThreadItem = { id: string; authorId: string; at: number; text: string; attachment?: Attachment | null; replyTo?: { id: string; text: string; authorId: string } | null; pending?: boolean };

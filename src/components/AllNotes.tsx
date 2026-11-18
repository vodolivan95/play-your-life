import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { htmlToText } from '../knowledgeBase';
import { noteColors, notesStorageKey, parseNotes } from '../sphereNotes';
import type { NotesData } from '../sphereNotes';
import { useStoredDoc } from './useStoredDoc';
import './SphereNotes.css';
import './AllNotes.css';

const SphereNotes = lazy(() => import('./SphereNotes'));

type SphereInfo = { id: string; name: string; icon: string; color?: string };
type Props = { ownerId: string; author: string; spheres: SphereInfo[]; notify: (message: string) => void };

const short = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Раздел меню «Заметки»: все заметки всех сфер, сгруппированные по сферам. Редактирование — в заметках сферы. */
export default function AllNotes({ ownerId, author, spheres, notify }: Props) {
  const [open, setOpen] = useState<{ sphere: string; note: string | null } | null>(null);
  if (open) {
    const sphere = spheres.find((s) => s.id === open.sphere);
    return (
      <div className="an">
        <button type="button" className="an-back" onClick={() => setOpen(null)}>← Все заметки</button>
        <Suspense fallback={<p role="status">Загружаем заметки…</p>}>
          <SphereNotes key={open.sphere} ownerId={ownerId} sphereId={open.sphere} sphereName={sphere?.name ?? ''} author={author} notify={notify} openNoteId={open.note} />
        </Suspense>
      </div>
    );
  }
  return <Overview ownerId={ownerId} spheres={spheres} onOpen={(sphere, note) => setOpen({ sphere, note })} />;
}

function Overview({ ownerId, spheres, onOpen }: { ownerId: string; spheres: SphereInfo[]; onOpen: (sphere: string, note: string | null) => void }) {
  const parse = useCallback((raw: string | null) => parseNotes(raw), []);
  const { doc } = useStoredDoc<NotesData>(notesStorageKey(ownerId), parse);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = doc.notes.filter((n) => !n.deletedAt && !n.archived && (!q || `${n.title} ${htmlToText(n.html)}`.toLowerCase().includes(q)));
    return spheres
      .map((s) => ({
        sphere: s,
        notes: active
          .filter((n) => n.sphereId === s.id)
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
      }))
      .filter((g) => g.notes.length > 0);
  }, [doc, spheres, query]);
  const total = groups.reduce((sum, g) => sum + g.notes.length, 0);
  const shown = filter === 'all' ? groups : groups.filter((g) => g.sphere.id === filter);

  return (
    <div className="an">
      <div className="an-top">
        <input className="an-search" type="search" placeholder="Поиск по всем заметкам" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск по всем заметкам" />
        <div className="an-chips" role="group" aria-label="Сфера">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Все сферы · {total}</button>
          {groups.map((g) => (
            <button key={g.sphere.id} type="button" aria-pressed={filter === g.sphere.id} onClick={() => setFilter(g.sphere.id)}>{g.sphere.icon} {g.sphere.name} · {g.notes.length}</button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <section className="panel an-empty">
          <h2>{query ? 'Ничего не найдено' : 'Заметок пока нет'}</h2>
          <p>{query ? 'Попробуй другой запрос.' : 'Заметки создаются во вкладке «Заметки» каждой сферы. Выбери сферу, чтобы начать:'}</p>
          {!query && (
            <div className="an-chips">
              {spheres.map((s) => <button key={s.id} type="button" onClick={() => onOpen(s.id, null)}>{s.icon} {s.name}</button>)}
            </div>
          )}
        </section>
      ) : (
        shown.map((g) => (
          <section key={g.sphere.id} className="an-group" aria-label={`Заметки сферы ${g.sphere.name}`}>
            <header>
              <h2><span aria-hidden="true">{g.sphere.icon}</span> {g.sphere.name} <small>{g.notes.length}</small></h2>
              <button type="button" className="an-open" onClick={() => onOpen(g.sphere.id, null)}>Открыть заметки сферы →</button>
            </header>
            <div className="sn-grid">
              {g.notes.map((n) => {
                const c = noteColors.find((x) => x.id === n.color) ?? noteColors[0];
                const text = htmlToText(n.html);
                return (
                  <article key={n.id} className={`sn-card${n.color === 'default' ? ' plain' : ''}`} style={{ '--sn-light': c.light, '--sn-dark': c.dark } as CSSProperties}>
                    <button type="button" className="sn-card-open" onClick={() => onOpen(g.sphere.id, n.id)} aria-label={`Открыть заметку ${n.title || text.slice(0, 30) || 'без названия'}`}>
                      {n.pinned && <span className="an-pin" aria-label="Закреплена">📌</span>}
                      {n.title && <h3>{n.title}</h3>}
                      {text ? <p className="sn-card-text an-text">{text.slice(0, 600)}</p> : !n.title && <p className="sn-muted">Пустая заметка</p>}
                      <footer><span>{short(n.updatedAt)}</span></footer>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

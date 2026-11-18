import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  addFolder, deleteNoteForever, dropIfEmpty, dueReminders, duplicateNote, emptyNotesTrash, filterNotes, noteColors, notesCounts, notesStorageKey,
  noteStats, parseNotes, removeFolder, renameFolder, restoreNote, trashNote, updateNote, createNote, NOTES_TRASH_DAYS,
} from '../sphereNotes';
import type { NoteColor, NotesData, NotesView, SphereNote } from '../sphereNotes';
import { htmlToText } from '../knowledgeBase';
import RichEditor from './RichEditor';
import { sanitizeHtml } from '../richText';
import { useStoredDoc } from './useStoredDoc';
import './SphereNotes.css';

const I: Record<string, ReactNode> = {
  all: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  pinned: <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />,
  starred: <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />,
  reminders: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  archive: <><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>,
  trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />,
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  folderPlus: <><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /><path d="M12 10v6M9 13h6" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  palette: <><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2" /></>,
  share: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  comment: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  history: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  copy: <><rect x="8" y="8" width="14" height="14" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  restore: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
};
const Ico = ({ n, size = 22, fill }: { n: string; size?: number; fill?: boolean }) => <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

const short = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const views: [NotesView, string, string][] = [['all', 'Все заметки', 'all'], ['pinned', 'Закреплённые', 'pinned'], ['starred', 'Избранное', 'starred'], ['reminders', 'Напоминания', 'reminders'], ['archive', 'Архив', 'archive'], ['trash', 'Корзина', 'trash']];
const colorOf = (id: NoteColor) => noteColors.find((c) => c.id === id) ?? noteColors[0];
const localInput = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

type Props = { ownerId: string; sphereId: string; sphereName: string; author: string; notify: (message: string) => void };

/** Заметки сферы: карточки как в Google Keep, папки, закреп и окно-редактор. */
export default function SphereNotes({ ownerId, sphereId, sphereName, author, notify }: Props) {
  const parse = useCallback((raw: string | null) => parseNotes(raw), []);
  const { doc, update, error, savedAt } = useStoredDoc<NotesData>(notesStorageKey(ownerId), parse);
  const [view, setView] = useState<NotesView>('all');
  const [folder, setFolder] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pop, setPop] = useState<'' | 'color' | 'reminder' | 'history' | 'folder'>('');
  const [folderDraft, setFolderDraft] = useState<{ id?: string; name: string } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- notify из App пересоздаётся на каждом рендере
  useEffect(() => { if (error) notify(error); }, [error]);
  // Напоминания срабатывают, пока открыт раздел заметок; сработавшее помечается выполненным.
  useEffect(() => {
    const check = () => {
      const due = dueReminders(doc);
      if (!due.length) return;
      notify(`Напоминание: ${due.map((n) => n.title || htmlToText(n.html).slice(0, 40) || 'заметка').join(', ')}`);
      update((d) => due.reduce((acc, n) => updateNote(acc, n.id, { reminderDone: true }), d));
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify из App пересоздаётся на каждом рендере
  }, [doc, update]);

  const counts = notesCounts(doc, sphereId);
  const folders = doc.folders.filter((f) => f.sphereId === sphereId);
  const list = useMemo(() => filterNotes(doc, sphereId, view, folder, query), [doc, sphereId, view, folder, query]);
  const pinned = view === 'all' ? list.filter((n) => n.pinned) : [];
  const others = view === 'all' ? list.filter((n) => !n.pinned) : list;
  const note = openId ? doc.notes.find((n) => n.id === openId) : undefined;

  const createNew = () => {
    const [next, n] = createNote(doc, { sphereId, folderId: folder, author });
    update(next);
    setOpenId(n.id);
    setPop('');
  };
  const close = () => { if (openId) update((d) => dropIfEmpty(d, openId)); setOpenId(null); setPop(''); };
  const patch = (id: string, p: Partial<SphereNote>) => update((d) => updateNote(d, id, p));
  const share = async (n: SphereNote) => {
    const text = `${n.title ? `${n.title}\n\n` : ''}${htmlToText(n.html)}`;
    try {
      if (navigator.share) await navigator.share({ title: n.title || 'Заметка', text });
      else { await navigator.clipboard.writeText(text); notify('Текст заметки скопирован.'); }
    } catch { /* пользователь закрыл окно «Поделиться» */ }
  };

  const card = (n: SphereNote) => {
    const c = colorOf(n.color);
    const text = htmlToText(n.html);
    return (
      <article key={n.id} className={`sn-card${n.color === 'default' ? ' plain' : ''}`} style={{ '--sn-light': c.light, '--sn-dark': c.dark } as CSSProperties}>
        <button type="button" className="sn-card-open" onClick={() => { setOpenId(n.id); setPop(''); }} aria-label={`Открыть заметку ${n.title || text.slice(0, 30) || 'без названия'}`}>
          {n.title && <h3>{n.title}</h3>}
          {n.html ? <div className="sn-card-text kb-prose" dangerouslySetInnerHTML={{ __html: previewHtml(n.html) }} /> : !n.title && <p className="sn-muted">Пустая заметка</p>}
          <footer>
            <span>{short(n.updatedAt)}</span>
            {n.reminderAt && <span className={`sn-chip${n.reminderDone ? ' done' : ''}`}><Ico n="reminders" size={13} />{short(n.reminderAt)}</span>}
            {n.folderId && folders.find((f) => f.id === n.folderId) && <span className="sn-chip"><Ico n="folder" size={13} />{folders.find((f) => f.id === n.folderId)!.name}</span>}
          </footer>
        </button>
        {view === 'trash' ? (
          <div className="sn-card-tools always">
            <button type="button" title="Восстановить" aria-label="Восстановить" onClick={() => update((d) => restoreNote(d, n.id))}><Ico n="restore" size={18} /></button>
            <button type="button" title="Удалить навсегда" aria-label="Удалить навсегда" onClick={() => { if (confirm('Удалить заметку навсегда?')) update((d) => deleteNoteForever(d, n.id)); }}><Ico n="trash" size={18} /></button>
          </div>
        ) : (
          <div className="sn-card-tools">
            <button type="button" className={n.pinned ? 'on' : ''} title={n.pinned ? 'Открепить' : 'Закрепить'} aria-label={n.pinned ? 'Открепить' : 'Закрепить'} onClick={() => patch(n.id, { pinned: !n.pinned })}><Ico n="pinned" size={18} fill={n.pinned} /></button>
            <button type="button" className={n.starred ? 'on' : ''} title="Избранное" aria-label="Избранное" onClick={() => patch(n.id, { starred: !n.starred })}><Ico n="starred" size={18} fill={n.starred} /></button>
            <button type="button" title={n.archived ? 'Вернуть из архива' : 'В архив'} aria-label={n.archived ? 'Вернуть из архива' : 'В архив'} onClick={() => patch(n.id, { archived: !n.archived, pinned: false })}><Ico n="archive" size={18} /></button>
            <button type="button" title="Удалить" aria-label="Удалить" onClick={() => update((d) => trashNote(d, n.id))}><Ico n="trash" size={18} /></button>
          </div>
        )}
      </article>
    );
  };

  const editor = note && (() => {
    const c = colorOf(note.color);
    const stats = noteStats(note);
    return (
      <div className="sn-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <section className="sn-editor" role="dialog" aria-modal="true" aria-label="Заметка" style={{ '--sn-light': c.light, '--sn-dark': c.dark } as CSSProperties} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
          <header className="sn-editor-head">
            <input className="sn-title" value={note.title} placeholder="Заголовок" aria-label="Заголовок заметки" onChange={(e) => patch(note.id, { title: e.target.value })} autoFocus={!note.title && !note.html} />
            <button type="button" className={`sn-icon${note.starred ? ' on' : ''}`} aria-label="Избранное" aria-pressed={note.starred} onClick={() => patch(note.id, { starred: !note.starred })}><Ico n="starred" fill={note.starred} /></button>
            <button type="button" className="sn-share" onClick={() => void share(note)}><Ico n="share" />Поделиться</button>
            <span className="sn-pop-wrap">
              <button type="button" className="sn-icon" aria-label="История версий" aria-expanded={pop === 'history'} onClick={() => setPop(pop === 'history' ? '' : 'history')}><Ico n="history" /></button>
              {pop === 'history' && (
                <div className="sn-pop right sn-history">
                  <b>История</b>
                  {note.versions.length ? [...note.versions].reverse().map((v) => (
                    <button key={v.id} type="button" onClick={() => { if (confirm('Вернуть эту версию? Текущий текст сохранится в истории.')) { patch(note.id, { title: v.title, html: v.html }); setPop(''); } }}>
                      <span>{short(v.at)}</span><small>{v.title || htmlToText(v.html).slice(0, 50) || 'Пусто'}</small>
                    </button>
                  )) : <small className="sn-muted">Версии появятся после правок (не чаще раза в 5 минут).</small>}
                </div>
              )}
            </span>
            <button type="button" className="sn-icon" aria-label="Закрыть" onClick={close}><Ico n="close" /></button>
          </header>
          <RichEditor
            docKey={note.id}
            variant="note"
            html={note.html}
            onChange={(html) => patch(note.id, { html })}
            placeholder="Заметка…"
            onError={notify}
            footer={<div className="sn-count"><span>{stats.words} слов · {stats.chars} знаков</span><span>Ctrl+B — жирный · Ctrl+I — курсив · Ctrl+U — подчёркнутый</span></div>}
          />
          <p className="sn-saved">Сохранено · {short(savedAt?.toISOString() ?? note.updatedAt)} · {note.author}</p>
          <footer className="sn-editor-foot">
            <button type="button" className={`sn-icon${note.pinned ? ' on' : ''}`} title={note.pinned ? 'Открепить' : 'Закрепить'} aria-label={note.pinned ? 'Открепить' : 'Закрепить'} aria-pressed={note.pinned} onClick={() => patch(note.id, { pinned: !note.pinned, archived: false })}><Ico n="pinned" fill={note.pinned} /></button>
            <span className="sn-pop-wrap">
              <button type="button" className={`sn-icon${note.reminderAt ? ' on' : ''}`} title="Напоминание" aria-label="Напоминание" aria-expanded={pop === 'reminder'} onClick={() => setPop(pop === 'reminder' ? '' : 'reminder')}><Ico n="reminders" /></button>
              {pop === 'reminder' && (
                <div className="sn-pop up">
                  <b>Напомнить</b>
                  <input type="datetime-local" value={localInput(note.reminderAt)} onChange={(e) => patch(note.id, { reminderAt: e.target.value ? new Date(e.target.value).toISOString() : undefined, reminderDone: false })} aria-label="Дата и время напоминания" />
                  <div className="sn-quick">
                    {([['Через час', 1], ['Завтра в 9:00', 0]] as const).map(([label, h]) => <button key={label} type="button" onClick={() => { const d = new Date(); if (h) d.setHours(d.getHours() + 1); else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } patch(note.id, { reminderAt: d.toISOString(), reminderDone: false }); setPop(''); }}>{label}</button>)}
                    {note.reminderAt && <button type="button" onClick={() => { patch(note.id, { reminderAt: undefined, reminderDone: false }); setPop(''); }}>Убрать</button>}
                  </div>
                  <small className="sn-muted">Напоминание появится, когда открыт раздел заметок.</small>
                </div>
              )}
            </span>
            <span className="sn-pop-wrap">
              <button type="button" className="sn-icon" title="Цвет" aria-label="Цвет заметки" aria-expanded={pop === 'color'} onClick={() => setPop(pop === 'color' ? '' : 'color')}><Ico n="palette" /></button>
              {pop === 'color' && <div className="sn-pop up sn-colors">{noteColors.map((col) => <button key={col.id} type="button" title={col.name} aria-label={col.name} aria-pressed={note.color === col.id} className={note.color === col.id ? 'on' : ''} style={{ '--sn-light': col.light, '--sn-dark': col.dark } as CSSProperties} onClick={() => patch(note.id, { color: col.id })} />)}</div>}
            </span>
            <span className="sn-pop-wrap">
              <button type="button" className={`sn-icon${note.folderId ? ' on' : ''}`} title="Папка" aria-label="Папка" aria-expanded={pop === 'folder'} onClick={() => setPop(pop === 'folder' ? '' : 'folder')}><Ico n="folder" /></button>
              {pop === 'folder' && (
                <div className="sn-pop up sn-folder-pick">
                  <b>Папка</b>
                  <button type="button" className={!note.folderId ? 'on' : ''} onClick={() => { patch(note.id, { folderId: null }); setPop(''); }}>Без папки</button>
                  {folders.map((f) => <button key={f.id} type="button" className={note.folderId === f.id ? 'on' : ''} onClick={() => { patch(note.id, { folderId: f.id }); setPop(''); }}>{f.name}</button>)}
                  {!folders.length && <small className="sn-muted">Папок пока нет — добавьте слева.</small>}
                </div>
              )}
            </span>
            <button type="button" className={`sn-icon${note.archived ? ' on' : ''}`} title={note.archived ? 'Вернуть из архива' : 'В архив'} aria-label={note.archived ? 'Вернуть из архива' : 'В архив'} onClick={() => { patch(note.id, { archived: !note.archived, pinned: false }); if (!note.archived) { notify('Заметка в архиве.'); close(); } }}><Ico n="archive" /></button>
            <button type="button" className="sn-icon" title="Копия" aria-label="Создать копию" onClick={() => { update((d) => duplicateNote(d, note.id)); notify('Копия создана.'); }}><Ico n="copy" /></button>
            <button type="button" className="sn-icon" title="Удалить" aria-label="Удалить заметку" onClick={() => { update((d) => trashNote(d, note.id)); setOpenId(null); notify('Заметка в корзине.'); }}><Ico n="trash" /></button>
            <span className="sn-owner">Ваша заметка</span>
          </footer>
        </section>
      </div>
    );
  })();

  return (
    <section className="sn" aria-label={`Заметки: ${sphereName}`}>
      <nav className="sn-nav" aria-label="Разделы заметок">
        {views.map(([k, label, icon]) => (
          <button key={k} type="button" className={view === k && !folder ? 'on' : ''} onClick={() => { setView(k); setFolder(null); }}>
            <Ico n={icon} /><span>{label}</span>{k === 'all' && <em>{counts.all}</em>}{k === 'trash' && counts.trash > 0 && <em>{counts.trash}</em>}
          </button>
        ))}
        <div className="sn-nav-label"><span>Папки</span><button type="button" aria-label="Добавить папку" onClick={() => setFolderDraft({ name: '' })}><Ico n="plus" size={20} /></button></div>
        {folders.map((f) => (
          <div key={f.id} className={`sn-folder${folder === f.id ? ' on' : ''}`}>
            <button type="button" onClick={() => { setFolder(f.id); setView('all'); }}><Ico n="folder" /><span>{f.name}</span><em>{doc.notes.filter((n) => n.folderId === f.id && !n.deletedAt && !n.archived).length}</em></button>
            <button type="button" className="sn-folder-edit" aria-label={`Переименовать папку ${f.name}`} onClick={() => setFolderDraft({ id: f.id, name: f.name })}>✎</button>
          </div>
        ))}
        {folderDraft ? (
          <form className="sn-folder-form" onSubmit={(e) => {
            e.preventDefault();
            if (folderDraft.id) update((d) => renameFolder(d, folderDraft.id!, folderDraft.name));
            else { const [next, f] = addFolder(doc, sphereId, folderDraft.name); update(next); if (f) setFolder(f.id); }
            setFolderDraft(null);
          }}>
            <input autoFocus value={folderDraft.name} onChange={(e) => setFolderDraft({ ...folderDraft, name: e.target.value })} placeholder="Название папки" aria-label="Название папки" />
            <div><button type="submit">Сохранить</button><button type="button" onClick={() => setFolderDraft(null)}>Отмена</button>{folderDraft.id && <button type="button" className="danger" onClick={() => { update((d) => removeFolder(d, folderDraft.id!)); if (folder === folderDraft.id) setFolder(null); setFolderDraft(null); }}>Удалить</button>}</div>
          </form>
        ) : (
          <button type="button" className="sn-add-folder" onClick={() => setFolderDraft({ name: '' })}><Ico n="folderPlus" /><span>Добавить папку</span></button>
        )}
      </nav>

      <div className="sn-main">
        <div className="sn-banner"><Ico n="lock" /><p>Заметки хранятся в этом браузере. Общий доступ, совместная работа и синхронизация между устройствами появятся после подключения хранения в облаке.</p></div>
        <div className="sn-toolbar">
          <label className="sn-search"><Ico n="search" /><input type="search" placeholder="Поиск по заметкам" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск по заметкам" /></label>
          <button type="button" className="sn-btn" onClick={() => setFolderDraft({ name: '' })}><Ico n="folderPlus" />Добавить папку</button>
          <button type="button" className="sn-btn primary" onClick={createNew}><Ico n="plus" />Создать заметку</button>
        </div>
        {view === 'trash' && (
          <div className="sn-trash-head"><span className="sn-muted">Заметки удаляются из корзины через {NOTES_TRASH_DAYS} дней.</span>{counts.trash > 0 && <button type="button" className="sn-btn" onClick={() => { if (confirm('Очистить корзину?')) update((d) => emptyNotesTrash(d, sphereId)); }}>Очистить корзину</button>}</div>
        )}
        {pinned.length > 0 && <><h4 className="sn-group">Закреплённые</h4><div className="sn-grid">{pinned.map(card)}</div></>}
        {pinned.length > 0 && others.length > 0 && <h4 className="sn-group">Другие</h4>}
        {others.length > 0 && <div className="sn-grid">{others.map(card)}</div>}
        {!list.length && (
          <div className="sn-empty">
            <Ico n={views.find(([k]) => k === view)?.[2] ?? 'all'} size={46} />
            <p>{query ? 'Ничего не найдено.' : view === 'all' ? `В сфере «${sphereName}» пока нет заметок.` : view === 'trash' ? 'Корзина пуста.' : view === 'archive' ? 'В архиве пусто.' : view === 'reminders' ? 'Нет заметок с напоминаниями.' : view === 'pinned' ? 'Нет закреплённых заметок.' : 'В избранном пусто.'}</p>
            {view === 'all' && !query && <button type="button" className="sn-btn primary" onClick={createNew}><Ico n="plus" />Создать заметку</button>}
          </div>
        )}
      </div>
      {editor}
    </section>
  );
}

/** Превью карточки: очищенная разметка без картинок и видео; длина ограничивается высотой карточки. */
function previewHtml(html: string): string {
  return sanitizeHtml(html.length > 6000 ? htmlToText(html).slice(0, 1500) : html).replace(/<(img|iframe)[^>]*>/gi, '');
}

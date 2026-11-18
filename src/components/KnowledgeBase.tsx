import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, ReactNode } from 'react';
import {
  addComment, addSpace, archiveArticle, breadcrumbs, childrenOf, createArticle, deleteForever, duplicateArticle, emptyTrash, htmlToMarkdown,
  isAlive, kbStorageKey, kbTemplates, markViewed, moveArticle, parseKnowledgeBase, removeSpace, removeTerm, restoreArticle, restoreVersion,
  saveTerm, searchArticles, spaceAnalytics, spaceOfSphere, tableOfContents, trashArticle, unarchiveArticle, updateArticle, updateComment,
  updateSpace, wordCount, KB_TRASH_DAYS,
} from '../knowledgeBase';
import type { KbArticle, KbSpace, KnowledgeBase as KbData } from '../knowledgeBase';
import RichEditor, { Svg } from './RichEditor';
import { EMOJI, readImage, sanitizeHtml } from '../richText';
import type { PageRef } from './RichEditor';
import { useStoredDoc } from './useStoredDoc';
import './KnowledgeBase.css';

type SphereLike = { id: string; name: string; icon: string; color: string };
type View =
  | { k: 'spaces' }
  | { k: 'home' }
  | { k: 'page'; id: string }
  | { k: 'glossary' }
  | { k: 'archive' }
  | { k: 'trash' }
  | { k: 'analytics' }
  | { k: 'favorites' }
  | { k: 'recent' };
type Rail = null | 'toc' | 'comments' | 'history' | 'info' | 'tasks';
type Dialog = null | 'create' | 'access' | 'move' | 'space' | 'newSpace' | 'link' | 'cover' | 'icon' | 'spaceIcon';

const COVERS = [
  'linear-gradient(135deg,#4f8cff,#9b6bff)', 'linear-gradient(135deg,#ff9a8b,#ff6a88,#ff99ac)', 'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)', 'linear-gradient(135deg,#30cfd0,#330867)', 'linear-gradient(135deg,#a8edea,#fed6e3)',
  'linear-gradient(135deg,#f6d365,#fda085)', 'linear-gradient(135deg,#0f2027,#2c5364)',
];
const date = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const initials = (name: string) => name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'Я';
const download = (name: string, body: string, type: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const fileName = (title: string) => (title || 'Без названия').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80);

function Avatar({ name, photo }: { name: string; photo?: string }) {
  return photo ? <img className="kb-avatar" src={photo} alt="" /> : <span className="kb-avatar" aria-hidden="true">{initials(name)}</span>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="kb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`kb-modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h3>{title}</h3><button type="button" className="kb-icon-btn" aria-label="Закрыть" onClick={onClose}>✕</button></header>
        {children}
      </section>
    </div>
  );
}

function EmojiGrid({ onPick }: { onPick: (e: string) => void }) {
  const extra = ['📘', '📗', '📕', '📙', '📓', '📄', '📋', '🗂️', '🗃️', '🧾', '🏷️', '🔖', '🧩', '⚙️', '🛠️', '🏆', '🎓', '🩺', '💼', '👨‍👩‍👧'];
  return <div className="kb-emoji-grid">{[...extra, ...EMOJI].map((e) => <button key={e} type="button" onClick={() => onPick(e)}>{e}</button>)}</div>;
}

type TreeProps = {
  kb: KbData;
  article: KbArticle;
  depth: number;
  currentId?: string;
  open: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onAddChild: (id: string) => void;
  onDrop: (dragId: string, targetId: string, mode: 'before' | 'after' | 'inside') => void;
};
function TreeItem({ kb, article, depth, currentId, open, onToggle, onOpen, onAddChild, onDrop }: TreeProps) {
  const kids = childrenOf(kb, article.spaceId, article.id);
  const expanded = open.has(article.id);
  const [over, setOver] = useState<'' | 'before' | 'after' | 'inside'>('');
  const zone = (e: DragEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  };
  return (
    <li>
      <div
        className={`kb-tree-row${currentId === article.id ? ' on' : ''}${over ? ` drop-${over}` : ''}`}
        style={{ paddingLeft: 8 + depth * 18 } as CSSProperties}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/kb-page', article.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(e) => { if ([...e.dataTransfer.types].includes('text/kb-page')) { e.preventDefault(); setOver(zone(e)); } }}
        onDragLeave={() => setOver('')}
        onDrop={(e) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/kb-page'); if (id && id !== article.id) onDrop(id, article.id, zone(e)); }}
      >
        <button type="button" className={`kb-caret${kids.length ? '' : ' is-leaf'}${expanded ? ' open' : ''}`} aria-label={expanded ? 'Свернуть' : 'Развернуть'} aria-expanded={expanded} onClick={() => onToggle(article.id)} tabIndex={kids.length ? 0 : -1}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </button>
        <button type="button" className="kb-tree-link" onClick={() => onOpen(article.id)}>
          <span className="kb-tree-icon">{article.icon}</span>
          <span className="kb-tree-title">{article.title || 'Без названия'}</span>
          {article.status === 'draft' && <span className="kb-dot" title="Черновик" />}
        </button>
        <button type="button" className="kb-tree-add" aria-label={`Создать вложенную статью в «${article.title || 'Без названия'}»`} onClick={() => onAddChild(article.id)}>+</button>
      </div>
      {expanded && kids.length > 0 && (
        <ul>{kids.map((k) => <TreeItem key={k.id} kb={kb} article={k} depth={depth + 1} currentId={currentId} open={open} onToggle={onToggle} onOpen={onOpen} onAddChild={onAddChild} onDrop={onDrop} />)}</ul>
      )}
    </li>
  );
}

type Props = { ownerId: string; author: string; photo?: string; spheres: SphereLike[]; sphereId?: string; notify: (message: string) => void };

/** База знаний: пространства по сферам жизни, дерево статей и редактор — по образцу Teamly. */
export default function KnowledgeBase({ ownerId, author, photo, spheres, sphereId, notify }: Props) {
  const parse = useCallback((raw: string | null) => parseKnowledgeBase(raw, spheres), [spheres]);
  const { doc: kb, update, error, savedAt } = useStoredDoc<KbData>(kbStorageKey(ownerId), parse);
  const [spaceId, setSpaceId] = useState(() => spaceOfSphere(kb, sphereId ?? '')?.id ?? kb.spaces[0]?.id ?? '');
  const [view, setView] = useState<View>({ k: 'home' });
  const [editing, setEditing] = useState(false);
  const [rail, setRail] = useState<Rail>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState<'' | 'page' | 'space'>('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [linksOpen, setLinksOpen] = useState(true);
  const [createIn, setCreateIn] = useState<string | null>(null);
  const [draft, setDraft] = useState({ a: '', b: '' });
  const [comment, setComment] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [termEdit, setTermEdit] = useState<{ id?: string; term: string; definition: string } | null>(null);
  const [termQuery, setTermQuery] = useState('');
  const viewed = useRef<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- notify из App пересоздаётся на каждом рендере
  useEffect(() => { if (error) notify(error); }, [error]);
  // Смена сферы во вкладке — переход в её пространство.
  useEffect(() => {
    const target = spaceOfSphere(kb, sphereId ?? '')?.id;
    if (target) queueMicrotask(() => { setSpaceId(target); setView({ k: 'home' }); setEditing(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sphereId]);

  const space: KbSpace | undefined = kb.spaces.find((s) => s.id === spaceId) ?? kb.spaces[0];
  const page = view.k === 'page' ? kb.articles.find((a) => a.id === view.id) : undefined;
  const roots = space ? childrenOf(kb, space.id, null) : [];
  const pages: PageRef[] = useMemo(() => kb.articles.filter((a) => isAlive(a) && a.spaceId === space?.id && a.id !== page?.id).map((a) => ({ id: a.id, title: a.title, icon: a.icon })), [kb.articles, space?.id, page?.id]);
  const hits = useMemo(() => (query.trim() && space ? searchArticles(kb, query, space.id) : []), [kb, query, space]);
  const status = savedAt ? `Сохранено ${savedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Сохранено';

  // Просмотр засчитывается один раз при открытии статьи.
  useEffect(() => {
    if (view.k === 'page' && viewed.current !== view.id) {
      viewed.current = view.id;
      const id = view.id;
      queueMicrotask(() => update((d) => markViewed(d, id)));
    }
    if (view.k !== 'page') viewed.current = null;
  }, [view, update]);

  const narrow = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches;
  // На телефоне дерево пространства сворачивается при открытии статьи, чтобы текст был сразу на экране.
  const go = (v: View) => { setView(v); setEditing(false); setMenu(''); setRail(null); if (narrow()) setCollapsed(v.k === 'page'); };
  const openPage = (id: string) => {
    const a = kb.articles.find((x) => x.id === id);
    if (!a) { notify('Статья не найдена: возможно, она удалена.'); return; }
    if (a.spaceId !== spaceId) setSpaceId(a.spaceId);
    setOpen((o) => new Set([...o, ...breadcrumbs(kb, id).slice(0, -1).map((x) => x.id)]));
    go({ k: 'page', id });
  };
  const create = (templateId: string) => {
    if (!space) return;
    const [next, article] = createArticle(kb, { spaceId: space.id, parentId: createIn, templateId, author });
    update(next);
    if (createIn) setOpen((o) => new Set(o).add(createIn));
    setDialog(null);
    setView({ k: 'page', id: article.id });
    if (narrow()) setCollapsed(true);
    setEditing(true);
    setRail(null);
  };
  const askCreate = (parent: string | null) => { setCreateIn(parent); setDialog('create'); };
  const patch = (p: Partial<KbArticle>) => page && update((d) => updateArticle(d, page.id, p, { author }));
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const drop = (dragId: string, targetId: string, mode: 'before' | 'after' | 'inside') => {
    const target = kb.articles.find((a) => a.id === targetId);
    if (!target) return;
    if (mode === 'inside') { update((d) => moveArticle(d, dragId, { parentId: targetId })); setOpen((o) => new Set(o).add(targetId)); return; }
    const siblings = childrenOf(kb, target.spaceId, target.parentId).filter((a) => a.id !== dragId);
    const index = siblings.findIndex((a) => a.id === targetId) + (mode === 'after' ? 1 : 0);
    update((d) => moveArticle(d, dragId, { parentId: target.parentId, spaceId: target.spaceId, index }));
  };

  const copyLink = async (a: KbArticle) => {
    const html = `<a class="kb-page-link" href="#" data-page="${a.id}">${a.icon} ${a.title || 'Без названия'}</a>`;
    try {
      if ('ClipboardItem' in window) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([a.title], { type: 'text/plain' }) })]);
      else await navigator.clipboard.writeText(a.title);
      notify('Ссылка скопирована. Вставьте её в другую статью — получится переход на эту страницу.');
    } catch { notify('Браузер не дал доступ к буферу обмена.'); }
  };
  const exportPage = (a: KbArticle, kind: 'md' | 'html') => {
    if (kind === 'md') download(`${fileName(a.title)}.md`, htmlToMarkdown(a.title, a.html), 'text/markdown;charset=utf-8');
    else download(`${fileName(a.title)}.html`, `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${a.title}</title><body style="font-family:system-ui;max-width:800px;margin:40px auto;line-height:1.6"><h1>${a.icon} ${a.title}</h1>${sanitizeHtml(a.html)}</body></html>`, 'text/html;charset=utf-8');
    setMenu('');
  };
  const setCover = async (file?: File) => {
    if (!file || !page) return;
    try { const src = await readImage(file, 1800); patch({ cover: `url(${src})` }); setDialog(null); }
    catch (e) { notify((e as Error).message); }
  };

  // ── Боковая панель ───────────────────────────────────────────────────────
  const sidebar = space && (
    <aside className={`kb-side${collapsed ? ' collapsed' : ''}`} aria-label="Навигация базы знаний">
      <div className="kb-side-head">
        <button type="button" className="kb-space-badge" style={{ '--kb-space': space.color } as CSSProperties} onClick={() => go({ k: 'home' })} aria-label={`Главная пространства ${space.name}`}>{space.icon}</button>
        <button type="button" className="kb-space-name" onClick={() => go({ k: 'home' })} title={space.name}>{space.name}</button>
        <button type="button" className="kb-icon-btn" aria-label="Свернуть панель" onClick={() => setCollapsed(true)}>«</button>
        <span className="kb-menu-wrap">
          <button type="button" className="kb-icon-btn" aria-label="Действия с пространством" aria-expanded={menu === 'space'} onClick={() => setMenu(menu === 'space' ? '' : 'space')}>•••</button>
          {menu === 'space' && (
            <div className="kb-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setDraft({ a: space.name, b: space.description }); setDialog('space'); setMenu(''); }}>Переименовать</button>
              <button type="button" role="menuitem" onClick={() => { setDialog('spaceIcon'); setMenu(''); }}>Сменить значок</button>
              <button type="button" role="menuitem" onClick={() => go({ k: 'spaces' })}>Список пространств</button>
              <button type="button" role="menuitem" onClick={() => { setDraft({ a: '', b: '' }); setDialog('newSpace'); setMenu(''); }}>Новое пространство</button>
              {!space.sphereId && <button type="button" role="menuitem" className="danger" onClick={() => { if (confirm(`Удалить пространство «${space.name}» со всеми статьями?`)) { update((d) => removeSpace(d, space.id)); setSpaceId(kb.spaces[0]?.id ?? ''); go({ k: 'spaces' }); } }}>Удалить пространство</button>}
            </div>
          )}
        </span>
      </div>

      <div className="kb-side-section">
        <div className="kb-side-label">
          <button type="button" className="kb-plain" aria-expanded={linksOpen} onClick={() => setLinksOpen(!linksOpen)}>Быстрые ссылки <span className={`kb-chev${linksOpen ? ' open' : ''}`}>⌄</span></button>
          <button type="button" className="kb-icon-btn small" aria-label="Добавить быструю ссылку" onClick={() => { setDraft({ a: '', b: '' }); setDialog('link'); }}>+</button>
        </div>
        {linksOpen && (
          <ul className="kb-links">
            {space.quickLinks.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">🔗 {l.title}</a>
                <button type="button" className="kb-icon-btn small" aria-label={`Убрать ссылку ${l.title}`} onClick={() => update((d) => updateSpace(d, space.id, { quickLinks: space.quickLinks.filter((x) => x.id !== l.id) }))}>×</button>
              </li>
            ))}
            {!space.quickLinks.length && <li><button type="button" className="kb-plain kb-add-link" onClick={() => { setDraft({ a: '', b: '' }); setDialog('link'); }}>＋ Добавить ссылку</button></li>}
          </ul>
        )}
      </div>

      <div className="kb-side-section grow">
        <div className="kb-side-label">
          <span>Пространство</span>
          <label className="kb-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Найти" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Поиск по пространству" /></label>
        </div>
        {query.trim() ? (
          <ul className="kb-hits">
            {hits.map((h) => <li key={h.article.id}><button type="button" onClick={() => { setQuery(''); openPage(h.article.id); }}><b>{h.article.icon} {h.article.title || 'Без названия'}</b><small>{h.snippet}</small></button></li>)}
            {!hits.length && <li className="kb-muted">Ничего не найдено</li>}
          </ul>
        ) : (
          <ul className="kb-tree"
            onDragOver={(e) => { if ([...e.dataTransfer.types].includes('text/kb-page')) e.preventDefault(); }}
            onDrop={(e) => { if (e.target === e.currentTarget) { const id = e.dataTransfer.getData('text/kb-page'); if (id) update((d) => moveArticle(d, id, { parentId: null, spaceId: space.id })); } }}>
            <li>
              <div className={`kb-tree-row root${view.k === 'home' ? ' on' : ''}`}>
                <button type="button" className="kb-tree-link" onClick={() => go({ k: 'home' })}><span className="kb-tree-icon">{space.icon}</span><span className="kb-tree-title">{space.name}</span></button>
                <button type="button" className="kb-tree-add" aria-label="Создать статью в пространстве" onClick={() => askCreate(null)}>+</button>
              </div>
            </li>
            {roots.map((a) => <TreeItem key={a.id} kb={kb} article={a} depth={1} currentId={page?.id} open={open} onToggle={toggle} onOpen={openPage} onAddChild={(id) => askCreate(id)} onDrop={drop} />)}
            {!roots.length && <li className="kb-muted kb-empty-tree">Статей пока нет. Нажмите «Создать».</li>}
          </ul>
        )}
      </div>

      <nav className="kb-side-foot" aria-label="Разделы пространства">
        {([['favorites', '☆', 'Избранное'], ['recent', '🕘', 'Недавние'], ['analytics', '📈', 'Аналитика'], ['glossary', '📖', 'Глоссарий'], ['archive', '🗄️', 'Архив'], ['trash', '🗑️', 'Корзина']] as const).map(([k, icon, label]) => (
          <button key={k} type="button" className={view.k === k ? 'on' : ''} onClick={() => go({ k })}><span aria-hidden="true">{icon}</span>{label}</button>
        ))}
      </nav>
      <div className="kb-create-row">
        <button type="button" className="kb-primary kb-create" onClick={() => askCreate(null)}>✎ Создать</button>
        <button type="button" className="kb-icon-btn" aria-label="Список пространств" title="Список пространств" onClick={() => go({ k: 'spaces' })}>▦</button>
      </div>
    </aside>
  );

  // ── Шапка с крошками ─────────────────────────────────────────────────────
  const crumbs = (
    <nav className="kb-crumbs" aria-label="Путь">
      {collapsed && <button type="button" className="kb-icon-btn kb-show-side" aria-label="Показать панель пространства" onClick={() => setCollapsed(false)}>☰</button>}
      <button type="button" className="kb-plain" onClick={() => go({ k: 'spaces' })}>Список пространств</button>
      {view.k !== 'spaces' && space && <><span>/</span><button type="button" className="kb-plain" onClick={() => go({ k: 'home' })}>{space.name}</button></>}
      {page && breadcrumbs(kb, page.id).map((a) => <span key={a.id} className="kb-crumb"><span>/</span><button type="button" className="kb-plain" onClick={() => openPage(a.id)}>{a.title || 'Без названия'}</button></span>)}
    </nav>
  );

  // ── Главная пространства ─────────────────────────────────────────────────
  const home = space && (
    <article className="kb-doc">
      <div className="kb-doc-title"><span className="kb-doc-icon">{space.icon}</span><h1>{space.name}</h1></div>
      <div className="kb-meta">
        <Avatar name={author} photo={photo} /><b>{author}</b><span className="kb-muted">{date(space.createdAt)}</span>
        <span className="kb-status is-published">● Опубликовано</span>
        <span className="kb-meta-right"><span className="kb-tag">#{space.name.replace(/\s+/g, '')}</span><span className="kb-muted">👁 {kb.articles.filter((a) => a.spaceId === space.id && isAlive(a)).reduce((s, a) => s + a.views, 0)}</span></span>
      </div>
      {roots.length > 0 && <div className="kb-chips">{roots.map((a) => <button key={a.id} type="button" className="kb-chip" onClick={() => openPage(a.id)}><span>{a.icon}</span>{a.title || 'Без названия'}</button>)}</div>}
      {editing ? (
        <RichEditor docKey={`space-${space.id}`} variant="kb" html={space.description} onChange={(html) => update((d) => updateSpace(d, space.id, { description: html }))} placeholder="Опишите пространство: для чего оно и как устроено" pages={pages} onOpenPage={openPage} author={author} onError={notify} status={status} />
      ) : space.description ? (
        <RichEditor docKey={`space-view-${space.id}`} variant="kb" html={space.description} onChange={() => undefined} readOnly onOpenPage={openPage} />
      ) : roots.length ? (
        <button type="button" className="kb-plain kb-muted kb-add-desc" onClick={() => setEditing(true)}>＋ Добавить описание пространства</button>
      ) : (
        <div className="kb-empty">
          <p>Пространство «{space.name}» пустое. Создайте первую статью — регламент, инструкцию, чек-лист или конспект.</p>
          <div className="kb-empty-actions"><button type="button" className="kb-primary" onClick={() => askCreate(null)}>＋ Создать статью</button><button type="button" className="kb-secondary" onClick={() => setEditing(true)}>Добавить описание</button></div>
        </div>
      )}
    </article>
  );

  // ── Статья ───────────────────────────────────────────────────────────────
  const toc = page ? tableOfContents(page.html) : [];
  const tasks = page ? [...page.html.matchAll(/<li[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => ({ done: m[1] === 'true', text: m[2].replace(/<[^>]+>/g, '').trim() })) : [];
  const scrollToHeading = (index: number) => {
    const headings = document.querySelectorAll('.kb-doc .re-content h1, .kb-doc .re-content h2, .kb-doc .re-content h3');
    headings[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const comments = page?.comments ?? [];
  const article = page && (
    <article className={`kb-doc${page.fullWidth ? ' full' : ''}`}>
      {page.cover && (
        <div className="kb-cover" style={{ backgroundImage: page.cover }}>
          {editing && <div className="kb-cover-actions"><button type="button" onClick={() => setDialog('cover')}>Сменить</button><button type="button" onClick={() => patch({ cover: undefined })}>Убрать</button></div>}
        </div>
      )}
      {editing && (
        <div className="kb-page-tools">
          {!page.cover && <button type="button" className="kb-plain" onClick={() => setDialog('cover')}>🖼 Обложка</button>}
          <button type="button" className="kb-plain" onClick={() => setDialog('icon')}>☺ Сменить значок</button>
          <button type="button" className="kb-plain" aria-pressed={!!page.fullWidth} onClick={() => patch({ fullWidth: !page.fullWidth })}>▭ {page.fullWidth ? 'Обычная ширина' : 'Во всю ширину'}</button>
        </div>
      )}
      <div className="kb-doc-title">
        <button type="button" className="kb-doc-icon" disabled={!editing} onClick={() => setDialog('icon')} aria-label="Значок статьи">{page.icon}</button>
        {editing ? <input className="kb-title-input" value={page.title} placeholder="Без названия" aria-label="Название статьи" onChange={(e) => patch({ title: e.target.value })} autoFocus={!page.title} /> : <h1>{page.title || 'Без названия'}</h1>}
      </div>
      <div className="kb-meta">
        <Avatar name={page.author} photo={page.author === author ? photo : undefined} /><b>{page.author}</b>
        <span className="kb-muted">{date(page.createdAt)} · обн. {date(page.updatedAt)}</span>
        <button type="button" className={`kb-status is-${page.status}`} disabled={!editing} title={editing ? 'Сменить статус' : undefined} onClick={() => patch({ status: page.status === 'published' ? 'draft' : 'published' })}>● {page.status === 'published' ? 'Опубликовано' : 'Черновик'}</button>
        {page.locked && <span className="kb-muted">🔒 Только чтение</span>}
        <span className="kb-meta-right">
          {page.tags.map((t) => <span key={t} className="kb-tag">#{t}{editing && <button type="button" aria-label={`Убрать тег ${t}`} onClick={() => patch({ tags: page.tags.filter((x) => x !== t) })}>×</button>}</span>)}
          {editing && <form onSubmit={(e) => { e.preventDefault(); const t = tagDraft.trim().replace(/^#/, '').replace(/\s+/g, '_').slice(0, 30); if (t && !page.tags.includes(t)) patch({ tags: [...page.tags, t] }); setTagDraft(''); }}><input className="kb-tag-input" placeholder="+ тег" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} aria-label="Новый тег" /></form>}
          <span className="kb-muted">👁 {page.views}</span>
        </span>
      </div>
      {(() => { const kids = childrenOf(kb, page.spaceId, page.id); return kids.length ? <div className="kb-chips">{kids.map((a) => <button key={a.id} type="button" className="kb-chip" onClick={() => openPage(a.id)}><span>{a.icon}</span>{a.title || 'Без названия'}</button>)}</div> : null; })()}
      <RichEditor key={editing ? 'edit' : 'read'} docKey={page.id} variant="kb" html={page.html} readOnly={!editing} onChange={(html) => patch({ html })} placeholder="Начните писать или выберите блок на панели «Вставить»" pages={pages} onOpenPage={openPage} author={author} onError={notify} status={status} />
      {!editing && !page.html && <p className="kb-muted kb-empty-page">Статья пока пустая. Нажмите «Редактировать», чтобы добавить текст.</p>}

      <section className="kb-comments" id="kb-comments" aria-label="Комментарии">
        <h2>💬 Комментарии {comments.length ? <span className="kb-muted">{comments.length}</span> : null}</h2>
        {comments.filter((c) => !c.parentId).map((c) => (
          <div key={c.id} className={`kb-comment${c.resolved ? ' resolved' : ''}`}>
            <Avatar name={c.author} photo={c.author === author ? photo : undefined} />
            <div>
              <div className="kb-comment-head"><b>{c.author}</b><span className="kb-muted">{dateTime(c.at)}</span>{c.resolved && <span className="kb-muted">✓ Решено</span>}</div>
              <p>{c.text}</p>
              <div className="kb-comment-actions">
                <button type="button" className="kb-plain" onClick={() => setReply(reply === c.id ? null : c.id)}>Ответить</button>
                <button type="button" className="kb-plain" onClick={() => update((d) => updateComment(d, page.id, c.id, { resolved: !c.resolved }))}>{c.resolved ? 'Открыть снова' : 'Решено'}</button>
                <button type="button" className="kb-plain" onClick={() => update((d) => updateComment(d, page.id, c.id, null))}>Удалить</button>
              </div>
              {comments.filter((r) => r.parentId === c.id).map((r) => (
                <div key={r.id} className="kb-comment reply"><Avatar name={r.author} photo={r.author === author ? photo : undefined} /><div><div className="kb-comment-head"><b>{r.author}</b><span className="kb-muted">{dateTime(r.at)}</span></div><p>{r.text}</p><button type="button" className="kb-plain" onClick={() => update((d) => updateComment(d, page.id, r.id, null))}>Удалить</button></div></div>
              ))}
            </div>
          </div>
        ))}
        <form className="kb-comment-form" onSubmit={(e) => { e.preventDefault(); if (!comment.trim()) return; update((d) => addComment(d, page.id, comment, author, reply ?? undefined)); setComment(''); setReply(null); }}>
          <Avatar name={author} photo={photo} />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={reply ? 'Ответ на комментарий…' : 'Напишите комментарий…'} aria-label="Комментарий" rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }} />
          <button type="submit" className="kb-primary" disabled={!comment.trim()}>Отправить</button>
        </form>
      </section>
    </article>
  );

  const railPanel = page && rail && (
    <aside className="kb-rail-panel" aria-label="Панель статьи">
      <header><b>{{ toc: 'Оглавление', comments: 'Комментарии', history: 'История изменений', info: 'О статье', tasks: 'Задачи в статье' }[rail]}</b><button type="button" className="kb-icon-btn small" aria-label="Закрыть панель" onClick={() => setRail(null)}>✕</button></header>
      {rail === 'toc' && (toc.length ? <ol className="kb-toc">{toc.map((h) => <li key={h.index} style={{ paddingLeft: (h.level - 1) * 12 }}><button type="button" className="kb-plain" onClick={() => scrollToHeading(h.index)}>{h.text}</button></li>)}</ol> : <p className="kb-muted">Добавьте заголовки — здесь появится оглавление.</p>)}
      {rail === 'comments' && (<><p className="kb-muted">Всего: {comments.length}, открытых: {comments.filter((c) => !c.resolved && !c.parentId).length}.</p><button type="button" className="kb-secondary" onClick={() => document.getElementById('kb-comments')?.scrollIntoView({ behavior: 'smooth' })}>К комментариям</button></>)}
      {rail === 'tasks' && (tasks.length ? <ul className="kb-task-list">{tasks.map((t, i) => <li key={i} className={t.done ? 'done' : ''}>{t.done ? '☑' : '☐'} {t.text || 'Пустой пункт'}</li>)}</ul> : <p className="kb-muted">В статье нет чек-листов.</p>)}
      {rail === 'history' && (
        page.versions.length ? (
          <ul className="kb-versions">
            <li className="current"><b>Текущая версия</b><small>{dateTime(page.updatedAt)}</small></li>
            {[...page.versions].reverse().map((v) => (
              <li key={v.id}><b>{v.title || 'Без названия'}</b><small>{dateTime(v.at)} · {v.author}</small><small>{wordCount(v.html).words} слов</small>
                <button type="button" className="kb-plain" disabled={page.locked} onClick={() => { if (confirm('Восстановить эту версию? Текущая сохранится в истории.')) update((d) => restoreVersion(d, page.id, v.id, author)); }}>Восстановить</button>
              </li>
            ))}
          </ul>
        ) : <p className="kb-muted">История появится после правок: версия сохраняется не чаще раза в 5 минут.</p>
      )}
      {rail === 'info' && (() => { const c = wordCount(page.html); return (
        <dl className="kb-info">
          <dt>Автор</dt><dd>{page.author}</dd>
          <dt>Создана</dt><dd>{dateTime(page.createdAt)}</dd>
          <dt>Обновлена</dt><dd>{dateTime(page.updatedAt)}</dd>
          <dt>Статус</dt><dd>{page.status === 'published' ? 'Опубликовано' : 'Черновик'}</dd>
          <dt>Просмотры</dt><dd>{page.views}</dd>
          <dt>Слов / знаков</dt><dd>{c.words} / {c.chars}</dd>
          <dt>Время чтения</dt><dd>≈ {Math.max(1, Math.round(c.words / 180))} мин</dd>
          <dt>Версий</dt><dd>{page.versions.length}</dd>
        </dl>
      ); })()}
    </aside>
  );

  // ── Списки: избранное, недавние, архив, корзина ─────────────────────────
  const list = (items: KbArticle[], empty: string, actions?: (a: KbArticle) => ReactNode) => (
    <ul className="kb-list">
      {items.map((a) => (
        <li key={a.id}>
          <button type="button" className="kb-list-main" onClick={() => (isAlive(a) ? openPage(a.id) : undefined)} disabled={!isAlive(a)}>
            <span className="kb-list-icon">{a.icon}</span>
            <span><b>{a.title || 'Без названия'}</b><small>{kb.spaces.find((s) => s.id === a.spaceId)?.name} · обн. {date(a.updatedAt)}</small></span>
          </button>
          {actions?.(a)}
        </li>
      ))}
      {!items.length && <li className="kb-muted kb-list-empty">{empty}</li>}
    </ul>
  );
  const spaceArticles = kb.articles.filter((a) => a.spaceId === space?.id);
  const listPage = (title: string, body: ReactNode, extra?: ReactNode) => <section className="kb-doc"><div className="kb-list-head"><h1>{title}</h1>{extra}</div>{body}</section>;

  const analytics = space && (() => {
    const s = spaceAnalytics(kb, space.id);
    return listPage('Аналитика', (
      <>
        <div className="kb-kpis">
          {([['Статей', s.total], ['Опубликовано', s.published], ['Черновиков', s.drafts], ['Просмотров', s.views], ['Комментариев', s.comments], ['Слов', s.words], ['Обновлено за неделю', s.updatedWeek], ['В архиве', s.archived]] as const).map(([l, v]) => <div key={l} className="kb-kpi"><b>{v}</b><small>{l}</small></div>)}
        </div>
        <div className="kb-two">
          <div><h2>Популярные</h2>{list(s.top, 'Пока нет просмотров.')}</div>
          <div><h2>Недавно обновлённые</h2>{list(s.recent, 'Статей пока нет.')}</div>
        </div>
        <h2>Давно не обновлялись (90+ дней)</h2>
        {list(s.stale, 'Все статьи свежие.')}
      </>
    ));
  })();

  const glossary = space && (() => {
    const terms = kb.glossary.filter((t) => t.spaceId === space.id && (!termQuery || `${t.term} ${t.definition}`.toLowerCase().includes(termQuery.toLowerCase()))).sort((a, b) => a.term.localeCompare(b.term, 'ru'));
    return listPage('Глоссарий', (
      <>
        <p className="kb-muted">Термины пространства «{space.name}»: короткие определения, к которым удобно возвращаться.</p>
        <input className="kb-input" type="search" placeholder="Найти термин" value={termQuery} onChange={(e) => setTermQuery(e.target.value)} aria-label="Найти термин" />
        {termEdit && (
          <form className="kb-term-form" onSubmit={(e) => { e.preventDefault(); update((d) => saveTerm(d, { ...termEdit, spaceId: space.id })); setTermEdit(null); }}>
            <input className="kb-input" placeholder="Термин" value={termEdit.term} onChange={(e) => setTermEdit({ ...termEdit, term: e.target.value })} aria-label="Термин" autoFocus required />
            <textarea className="kb-input" placeholder="Определение" value={termEdit.definition} onChange={(e) => setTermEdit({ ...termEdit, definition: e.target.value })} aria-label="Определение" rows={3} />
            <div className="kb-row"><button type="submit" className="kb-primary">Сохранить</button><button type="button" className="kb-secondary" onClick={() => setTermEdit(null)}>Отмена</button></div>
          </form>
        )}
        <dl className="kb-terms">
          {terms.map((t) => (
            <div key={t.id}>
              <dt>{t.term}<span><button type="button" className="kb-plain" onClick={() => setTermEdit({ id: t.id, term: t.term, definition: t.definition })}>Изменить</button><button type="button" className="kb-plain" onClick={() => update((d) => removeTerm(d, t.id))}>Удалить</button></span></dt>
              <dd>{t.definition || '—'}</dd>
            </div>
          ))}
          {!terms.length && <p className="kb-muted">Терминов пока нет.</p>}
        </dl>
      </>
    ), <button type="button" className="kb-primary" onClick={() => setTermEdit({ term: '', definition: '' })}>＋ Термин</button>);
  })();

  const spacesPage = listPage('Список пространств', (
    <div className="kb-space-grid">
      {kb.spaces.map((s) => {
        const count = kb.articles.filter((a) => a.spaceId === s.id && isAlive(a)).length;
        return (
          <button key={s.id} type="button" className="kb-space-card" style={{ '--kb-space': s.color } as CSSProperties} onClick={() => { setSpaceId(s.id); go({ k: 'home' }); }}>
            <span className="kb-space-badge">{s.icon}</span>
            <b>{s.name}</b>
            <small>{count} {count % 10 === 1 && count % 100 !== 11 ? 'статья' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'статьи' : 'статей'}{s.sphereId ? ' · сфера жизни' : ''}</small>
          </button>
        );
      })}
    </div>
  ), <button type="button" className="kb-primary" onClick={() => { setDraft({ a: '', b: '' }); setDialog('newSpace'); }}>＋ Новое пространство</button>);

  let main: ReactNode = null;
  if (view.k === 'spaces') main = spacesPage;
  else if (view.k === 'home') main = home;
  else if (view.k === 'page') main = article ?? <section className="kb-doc"><p className="kb-muted">Статья не найдена. Возможно, она в корзине.</p><button type="button" className="kb-secondary" onClick={() => go({ k: 'home' })}>На главную пространства</button></section>;
  else if (view.k === 'favorites') main = listPage('Избранное', list(kb.articles.filter((a) => a.favorite && isAlive(a)), 'Отмечайте статьи звёздочкой — они появятся здесь.'));
  else if (view.k === 'recent') main = listPage('Недавние', list(kb.recent.map((id) => kb.articles.find((a) => a.id === id)).filter((a): a is KbArticle => !!a && isAlive(a)), 'Вы ещё не открывали статьи.'));
  else if (view.k === 'archive') main = listPage('Архив', list(spaceArticles.filter((a) => a.archivedAt && !a.deletedAt && !(a.parentId && spaceArticles.find((p) => p.id === a.parentId)?.archivedAt)), 'В архиве пусто. Архив хранит неактуальные статьи без удаления.', (a) => <span className="kb-row"><button type="button" className="kb-secondary" onClick={() => update((d) => unarchiveArticle(d, a.id))}>Вернуть</button><button type="button" className="kb-plain danger" onClick={() => update((d) => trashArticle(d, a.id))}>В корзину</button></span>));
  else if (view.k === 'trash') main = listPage('Корзина', (
    <>
      <p className="kb-muted">Статьи хранятся в корзине {KB_TRASH_DAYS} дней, затем удаляются навсегда.</p>
      {list(spaceArticles.filter((a) => a.deletedAt && !(a.parentId && spaceArticles.find((p) => p.id === a.parentId)?.deletedAt)), 'Корзина пуста.', (a) => <span className="kb-row"><button type="button" className="kb-secondary" onClick={() => update((d) => restoreArticle(d, a.id))}>Восстановить</button><button type="button" className="kb-plain danger" onClick={() => { if (confirm('Удалить статью навсегда?')) update((d) => deleteForever(d, a.id)); }}>Удалить навсегда</button></span>)}
    </>
  ), spaceArticles.some((a) => a.deletedAt) ? <button type="button" className="kb-secondary danger" onClick={() => { if (confirm('Очистить корзину пространства?')) update((d) => emptyTrash(d, space?.id)); }}>Очистить корзину</button> : undefined);
  else if (view.k === 'analytics') main = analytics;
  else if (view.k === 'glossary') main = glossary;

  const pageActions = view.k === 'page' && page && (
    <div className="kb-actions">
      <Avatar name={author} photo={photo} />
      {editing
        ? <button type="button" className="kb-primary" onClick={() => setEditing(false)}>✓ Готово</button>
        : <button type="button" className="kb-secondary" disabled={page.locked} title={page.locked ? 'Статья закреплена от правок — снимите замок в «Доступ»' : undefined} onClick={() => setEditing(true)}>✎ Редактировать</button>}
      <button type="button" className="kb-secondary" onClick={() => setDialog('access')}>🔒 Доступ</button>
      <button type="button" className={`kb-icon-btn${page.favorite ? ' fav' : ''}`} aria-label={page.favorite ? 'Убрать из избранного' : 'В избранное'} aria-pressed={page.favorite} onClick={() => update((d) => updateArticle(d, page.id, { favorite: !page.favorite }))}>{page.favorite ? '★' : '☆'}</button>
      <button type="button" className="kb-icon-btn" aria-label="Скопировать ссылку на статью" title="Скопировать ссылку на статью" onClick={() => void copyLink(page)}><Svg name="link" size={18} /></button>
      <span className="kb-menu-wrap">
        <button type="button" className="kb-icon-btn" aria-label="Ещё действия" aria-expanded={menu === 'page'} onClick={() => setMenu(menu === 'page' ? '' : 'page')}>•••</button>
        {menu === 'page' && (
          <div className="kb-menu right" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenu(''); askCreate(page.id); }}>Создать вложенную статью</button>
            <button type="button" role="menuitem" onClick={() => { const [next, copy] = duplicateArticle(kb, page.id, author); update(next); setMenu(''); if (copy) openPage(copy.id); }}>Дублировать</button>
            <button type="button" role="menuitem" onClick={() => { setDraft({ a: page.spaceId, b: page.parentId ?? '' }); setDialog('move'); setMenu(''); }}>Переместить</button>
            <button type="button" role="menuitem" onClick={() => exportPage(page, 'md')}>Скачать Markdown</button>
            <button type="button" role="menuitem" onClick={() => exportPage(page, 'html')}>Скачать HTML</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(''); setTimeout(() => window.print(), 50); }}>Печать / PDF</button>
            <button type="button" role="menuitem" onClick={() => { update((d) => archiveArticle(d, page.id)); notify('Статья перенесена в архив.'); go({ k: 'home' }); }}>В архив</button>
            <button type="button" role="menuitem" className="danger" onClick={() => { update((d) => trashArticle(d, page.id)); notify('Статья перенесена в корзину.'); go({ k: 'home' }); }}>Удалить</button>
          </div>
        )}
      </span>
    </div>
  );
  const homeActions = view.k === 'home' && space && (
    <div className="kb-actions">
      <Avatar name={author} photo={photo} />
      {editing ? <button type="button" className="kb-primary" onClick={() => setEditing(false)}>✓ Готово</button> : <button type="button" className="kb-secondary" onClick={() => setEditing(true)}>✎ Редактировать</button>}
      <button type="button" className="kb-secondary" onClick={() => setDialog('access')}>🔒 Доступ</button>
    </div>
  );

  const railButtons = view.k === 'page' && page && (
    <div className="kb-rail" role="toolbar" aria-label="Панели статьи">
      {([['toc', 'Оглавление', <path key="p" d="M4 6h16M4 12h10M4 18h13" />], ['comments', 'Комментарии', <path key="p" d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />], ['tasks', 'Задачи', <><rect key="r" x="4" y="4" width="16" height="16" rx="3" /><path key="p" d="m8 12 3 3 5-6" /></>], ['history', 'История', <path key="p" d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2" />], ['info', 'Информация', <><circle key="c" cx="12" cy="12" r="10" /><path key="p" d="M12 16v-4M12 8h.01" /></>]] as const).map(([k, label, icon]) => (
        <button key={k} type="button" className={rail === k ? 'on' : ''} aria-label={label} title={label} aria-pressed={rail === k} onClick={() => setRail(rail === k ? null : k)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
          {k === 'comments' && comments.length > 0 && <em>{comments.length}</em>}
        </button>
      ))}
    </div>
  );

  return (
    <section className={`kb${collapsed ? ' side-collapsed' : ''}`} aria-label="База знаний" onClick={(e) => { if (menu && !(e.target as HTMLElement).closest('.kb-menu-wrap')) setMenu(''); }}>
      {view.k !== 'spaces' && sidebar}
      <div className="kb-main">
        <header className="kb-top">{crumbs}{pageActions}{homeActions}</header>
        <div className="kb-body">
          <div className="kb-scroll">{main}</div>
          {railPanel}
          {railButtons}
        </div>
      </div>

      {dialog === 'create' && space && (
        <Modal title={createIn ? 'Новая вложенная статья' : `Новая статья в «${space.name}»`} onClose={() => setDialog(null)} wide>
          <div className="kb-templates">
            {kbTemplates.map((t) => <button key={t.id} type="button" onClick={() => create(t.id)}><span>{t.icon}</span><b>{t.name}</b><small>{t.description}</small></button>)}
          </div>
        </Modal>
      )}
      {dialog === 'access' && (
        <Modal title="Доступ" onClose={() => setDialog(null)}>
          <div className="kb-access">
            <p>Статьи хранятся в этом браузере и видны только вам. Общий доступ, совместная работа и синхронизация между устройствами появятся после подключения хранения в облаке.</p>
            {page && (
              <label className="kb-check"><input type="checkbox" checked={!!page.locked} onChange={() => { update((d) => updateArticle(d, page.id, { locked: !page.locked })); if (!page.locked) setEditing(false); }} /> Только чтение — защитить статью от случайных правок</label>
            )}
            {page && <div className="kb-row"><button type="button" className="kb-secondary" onClick={() => exportPage(page, 'md')}>Скачать Markdown</button><button type="button" className="kb-secondary" onClick={() => exportPage(page, 'html')}>Скачать HTML</button></div>}
          </div>
        </Modal>
      )}
      {dialog === 'icon' && page && <Modal title="Значок статьи" onClose={() => setDialog(null)}><EmojiGrid onPick={(e) => { patch({ icon: e }); setDialog(null); }} /></Modal>}
      {dialog === 'spaceIcon' && space && <Modal title="Значок пространства" onClose={() => setDialog(null)}><EmojiGrid onPick={(e) => { update((d) => updateSpace(d, space.id, { icon: e })); setDialog(null); }} /></Modal>}
      {dialog === 'cover' && page && (
        <Modal title="Обложка" onClose={() => setDialog(null)}>
          <div className="kb-covers">{COVERS.map((c) => <button key={c} type="button" style={{ backgroundImage: c }} aria-label="Градиентная обложка" onClick={() => { patch({ cover: c }); setDialog(null); }} />)}</div>
          <button type="button" className="kb-secondary" onClick={() => coverInput.current?.click()}>Загрузить изображение</button>
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { void setCover(e.target.files?.[0]); e.target.value = ''; }} />
        </Modal>
      )}
      {dialog === 'link' && space && (
        <Modal title="Быстрая ссылка" onClose={() => setDialog(null)}>
          <form className="kb-form" onSubmit={(e) => { e.preventDefault(); const url = draft.b.trim(); if (!url) return; const href = /^https?:\/\//i.test(url) ? url : `https://${url}`; update((d) => updateSpace(d, space.id, { quickLinks: [...space.quickLinks, { id: `${Date.now()}`, title: draft.a.trim() || url, url: href }] })); setDialog(null); }}>
            <input className="kb-input" placeholder="Название" value={draft.a} onChange={(e) => setDraft({ ...draft, a: e.target.value })} aria-label="Название ссылки" autoFocus />
            <input className="kb-input" placeholder="https://…" value={draft.b} onChange={(e) => setDraft({ ...draft, b: e.target.value })} aria-label="Адрес" required />
            <button type="submit" className="kb-primary">Добавить</button>
          </form>
        </Modal>
      )}
      {(dialog === 'space' || dialog === 'newSpace') && (
        <Modal title={dialog === 'space' ? 'Пространство' : 'Новое пространство'} onClose={() => setDialog(null)}>
          <form className="kb-form" onSubmit={(e) => {
            e.preventDefault();
            if (dialog === 'space' && space) update((d) => updateSpace(d, space.id, { name: draft.a.trim() || space.name }));
            else { const [next, created] = addSpace(kb, { name: draft.a }); update(next); setSpaceId(created.id); go({ k: 'home' }); }
            setDialog(null);
          }}>
            <input className="kb-input" placeholder="Название пространства" value={draft.a} onChange={(e) => setDraft({ ...draft, a: e.target.value })} aria-label="Название пространства" autoFocus required />
            <button type="submit" className="kb-primary">{dialog === 'space' ? 'Сохранить' : 'Создать'}</button>
          </form>
        </Modal>
      )}
      {dialog === 'move' && page && (
        <Modal title="Переместить статью" onClose={() => setDialog(null)}>
          <form className="kb-form" onSubmit={(e) => { e.preventDefault(); update((d) => moveArticle(d, page.id, { spaceId: draft.a, parentId: draft.b || null })); setSpaceId(draft.a); setDialog(null); notify('Статья перемещена.'); }}>
            <label className="kb-field">Пространство<select className="kb-input" value={draft.a} onChange={(e) => setDraft({ a: e.target.value, b: '' })}>{kb.spaces.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}</select></label>
            <label className="kb-field">Родительская статья<select className="kb-input" value={draft.b} onChange={(e) => setDraft({ ...draft, b: e.target.value })}>
              <option value="">— Верхний уровень —</option>
              {kb.articles.filter((a) => a.spaceId === draft.a && isAlive(a) && a.id !== page.id && !breadcrumbs(kb, a.id).some((x) => x.id === page.id)).map((a) => <option key={a.id} value={a.id}>{'— '.repeat(breadcrumbs(kb, a.id).length - 1)}{a.icon} {a.title || 'Без названия'}</option>)}
            </select></label>
            <button type="submit" className="kb-primary">Переместить</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

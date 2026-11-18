import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './RichEditor.css';
import { EMOJI, MAX_ATTACHMENT, esc, readFile, readImage, sanitizeHtml, videoEmbedUrl } from '../richText';

/**
 * Визуальный редактор статей и заметок на contentEditable.
 * `variant="kb"` — панель как в Teamly (вставка таблиц, файлов, страниц, колонок, видео и т. д.),
 * `variant="note"` — компактная панель заметки (индексы, отступы, выравнивание по ширине).
 * Вставленный и загруженный HTML очищается от скриптов, обработчиков и опасных ссылок.
 */

// ── Значки панели (обводка 2 px, как в Teamly) ──────────────────────────────
const P: Record<string, ReactNode> = {
  undo: <path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4" />,
  redo: <path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h4" />,
  bold: <path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />,
  italic: <path d="M19 4h-9M14 20H5M15 4 9 20" />,
  underline: <path d="M6 4v6a6 6 0 0 0 12 0V4M4 21h16" />,
  strike: <path d="M16 4H9a3 3 0 0 0-2.8 4M14 12a4 4 0 0 1 0 8H6M4 12h16" />,
  sub: <path d="m4 5 8 8M12 5l-8 8M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.1 2.1 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07" />,
  sup: <path d="m4 19 8-8M12 19l-8-8M20 12h-4c0-1.5.44-2 1.5-2.5S20 8.33 20 7c0-.47-.17-.93-.48-1.29a2.1 2.1 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07" />,
  color: <path d="M5 20 12 4l7 16M8 14h8" />,
  marker: <path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />,
  clear: <path d="M4 7V4h16v3M5 20h6M13 4 8 20M15 15l5 5M20 15l-5 5" />,
  left: <path d="M4 6h16M4 12h10M4 18h14" />,
  center: <path d="M4 6h16M7 12h10M5 18h14" />,
  right: <path d="M4 6h16M10 12h10M6 18h14" />,
  justify: <path d="M4 6h16M4 12h16M4 18h16" />,
  ul: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  ol: <path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />,
  check: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></>,
  outdent: <path d="M21 12H11M21 6H11M21 18H11M7 8l-4 4 4 4" />,
  indent: <path d="M21 12H11M21 6H11M21 18H11M3 8l4 4-4 4" />,
  link: <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  unlink: <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  page: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  table: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></>,
  callout: <><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
  mention: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>,
  quote: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h10M7 14h6" /></>,
  toggle: <path d="M5 4v16M10 6l6 6-6 6" />,
  columns: <><rect x="3" y="4" width="7" height="16" rx="2" /><rect x="14" y="4" width="7" height="16" rx="2" /></>,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />,
  video: <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m22 8-6 4 6 4z" /></>,
  divider: <path d="M4 12h16" />,
  emoji: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
};
export function Svg({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;
}

function B({ name, title, on, onPress, wide }: { name: string; title: string; on?: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <button type="button" className={`re-btn${on ? ' on' : ''}${wide ? ' wide' : ''}`} title={title} aria-label={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onPress}><Svg name={name} /></button>
  );
}

const FONTS = ['Manrope', 'Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40];
const PALETTE = ['#111827', '#6b7280', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
const HIGHLIGHT = ['transparent', '#fef08a', '#bbf7d0', '#bae6fd', '#ddd6fe', '#fbcfe8', '#fed7aa', '#e5e7eb'];

export type PageRef = { id: string; title: string; icon: string };
type Props = {
  docKey: string;
  html: string;
  onChange: (html: string) => void;
  variant: 'kb' | 'note';
  placeholder?: string;
  readOnly?: boolean;
  /** Статьи, на которые можно сослаться кнопкой «Страница». */
  pages?: PageRef[];
  onOpenPage?: (id: string) => void;
  author?: string;
  onError?: (message: string) => void;
  /** Строка статуса справа на панели («Сохранено»). */
  status?: string;
  footer?: ReactNode;
};

type Popup = null | 'color' | 'marker' | 'emoji' | 'page' | 'link' | 'video' | 'table';

export default function RichEditor({ docKey, html, onChange, variant, placeholder, readOnly, pages = [], onOpenPage, author = 'Я', onError, status, footer }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const image = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState('p');
  const [popup, setPopup] = useState<Popup>(null);
  const [input, setInput] = useState('');
  const [table, setTable] = useState({ rows: 3, cols: 3 });
  const emitted = useRef(html);

  // Новый документ — новое содержимое; свои же правки обратно не подставляются, чтобы не прыгал курсор.
  useEffect(() => {
    if (!box.current) return;
    box.current.innerHTML = sanitizeHtml(html);
    emitted.current = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);
  useEffect(() => {
    if (box.current && html !== emitted.current && document.activeElement !== box.current) {
      box.current.innerHTML = sanitizeHtml(html);
      emitted.current = html;
    }
  }, [html]);

  const emit = useCallback(() => {
    if (!box.current) return;
    const next = box.current.innerHTML === '<br>' ? '' : box.current.innerHTML;
    emitted.current = next;
    onChange(next);
  }, [onChange]);

  const refresh = useCallback(() => {
    const sel = document.getSelection();
    if (!box.current || !sel?.rangeCount || !box.current.contains(sel.anchorNode)) return;
    saved.current = sel.getRangeAt(0).cloneRange();
    const q = (c: string) => { try { return document.queryCommandState(c); } catch { return false; } };
    setActive({ bold: q('bold'), italic: q('italic'), underline: q('underline'), strikeThrough: q('strikeThrough'), subscript: q('subscript'), superscript: q('superscript'), insertUnorderedList: q('insertUnorderedList'), insertOrderedList: q('insertOrderedList'), justifyCenter: q('justifyCenter'), justifyRight: q('justifyRight'), justifyFull: q('justifyFull') });
    let node: Node | null = sel.anchorNode;
    let tag = 'p';
    while (node && node !== box.current) {
      if (node instanceof HTMLElement && /^(H1|H2|H3|BLOCKQUOTE|PRE)$/.test(node.tagName)) { tag = node.tagName.toLowerCase(); break; }
      node = node.parentNode;
    }
    setBlock(tag);
  }, []);
  useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
  }, [refresh]);

  const restore = () => {
    const el = box.current;
    if (!el) return;
    el.focus();
    const sel = document.getSelection();
    if (saved.current && sel && el.contains(saved.current.startContainer)) { sel.removeAllRanges(); sel.addRange(saved.current); }
    else if (sel) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
  };
  const exec = (command: string, value?: string) => {
    restore();
    document.execCommand('styleWithCSS', false, command === 'hiliteColor' || command === 'foreColor' ? 'true' : 'false');
    document.execCommand(command, false, value);
    emit();
    refresh();
  };
  const insert = (fragment: string) => {
    restore();
    // Блоки (таблица, выноска, колонки, чек-лист и т. п.) вставляются после текущего абзаца, а не внутрь строки.
    const sel = document.getSelection();
    if (/^<(table|div|details|hr|ul|figure)/.test(fragment) && sel?.rangeCount && box.current) {
      let top: Node | null = sel.anchorNode;
      while (top && top.parentNode !== box.current) top = top.parentNode;
      if (top && top !== box.current && (top.textContent ?? '').trim()) {
        const p = document.createElement('p');
        p.append(document.createElement('br'));
        top.parentNode!.insertBefore(p, top.nextSibling);
        const r = document.createRange();
        r.setStart(p, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }
    document.execCommand('insertHTML', false, sanitizeHtml(fragment));
    emit();
    setPopup(null);
  };
  const wrapStyle = (style: 'fontFamily' | 'fontSize', value: string) => {
    restore();
    const sel = document.getSelection();
    if (!sel?.rangeCount || sel.isCollapsed) { onError?.('Выделите текст, чтобы изменить шрифт или размер.'); return; }
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontName', false, '__pyl__');
    box.current?.querySelectorAll('font[face="__pyl__"]').forEach((f) => {
      const span = document.createElement('span');
      span.style[style] = value;
      span.append(...f.childNodes);
      f.replaceWith(span);
    });
    emit();
  };
  const setBlockType = (tag: string) => { exec('formatBlock', tag === 'p' ? 'P' : tag.toUpperCase()); };

  const addLink = () => {
    const url = input.trim();
    if (!url) return;
    const href = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
    restore();
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed) { document.execCommand('createLink', false, href); box.current?.querySelectorAll(`a[href="${CSS.escape(href)}"]`).forEach((a) => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }); emit(); setPopup(null); }
    else insert(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>&nbsp;`);
    setInput('');
  };
  const addVideo = () => {
    const src = videoEmbedUrl(input);
    if (!src) { onError?.('Поддерживаются ссылки YouTube, Rutube, VK Видео и Vimeo.'); return; }
    insert(`<div class="kb-video" data-kb-block="video"><iframe src="${esc(src)}" allowfullscreen></iframe></div><p><br></p>`);
    setInput('');
  };
  const addTable = (data = false) => {
    const { rows, cols } = table;
    const head = `<tr>${Array.from({ length: cols }, (_, i) => `<th>${data ? `Поле ${i + 1}` : '<br>'}</th>`).join('')}</tr>`;
    const body = Array.from({ length: Math.max(1, rows - 1) }, () => `<tr>${Array.from({ length: cols }, () => '<td><br></td>').join('')}</tr>`).join('');
    insert(`<table class="kb-table${data ? ' is-data' : ''}"><tbody>${head}${body}</tbody></table><p><br></p>`);
  };
  const onImage = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { onError?.('Выберите изображение.'); return; }
    try { const src = await readImage(f); insert(`<figure class="kb-figure"><img src="${src}" alt="${esc(f.name)}"><figcaption><br></figcaption></figure><p><br></p>`); }
    catch (e) { onError?.((e as Error).message); }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_ATTACHMENT) { onError?.('Файл больше 2 МБ: в браузере для него не хватит места. Добавьте ссылку на облако.'); return; }
    try { const src = await readFile(f); insert(`<a class="kb-file" href="${src}" download="${esc(f.name)}" data-kb-block="file">📎 ${esc(f.name)} · ${Math.max(1, Math.round(f.size / 1024))} КБ</a>&nbsp;`); }
    catch (e) { onError?.((e as Error).message); }
  };

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const li = target.closest('ul.kb-checklist > li') as HTMLElement | null;
    if (li && e.clientX - li.getBoundingClientRect().left < 28) {
      li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true');
      emit();
      e.preventDefault();
      return;
    }
    const pageLink = target.closest('a[data-page]') as HTMLElement | null;
    if (pageLink && (readOnly || e.ctrlKey || e.metaKey)) { e.preventDefault(); onOpenPage?.(pageLink.dataset.page!); return; }
    const link = target.closest('a[href]') as HTMLAnchorElement | null;
    if (link && readOnly && !link.dataset.page && !link.hasAttribute('download')) { e.preventDefault(); window.open(link.href, '_blank', 'noopener'); }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); void onImage(files.find((f) => f.type.startsWith('image/'))); return; }
    const data = e.clipboardData.getData('text/html');
    if (data) { e.preventDefault(); document.execCommand('insertHTML', false, sanitizeHtml(data.replace(/<!--[\s\S]*?-->/g, ''))); emit(); }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); refresh(); setInput(''); setPopup('link'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') { e.preventDefault(); exec('insertOrderedList'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') { e.preventDefault(); exec('insertUnorderedList'); }
    if (e.key === 'Tab' && variant === 'note') { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
    // Маркдаун-сокращения в начале строки: «# », «## », «- », «1. », «[] », «> »
    if (e.key === ' ' && !readOnly) {
      const sel = document.getSelection();
      const node = sel?.anchorNode;
      if (node?.nodeType === Node.TEXT_NODE && sel!.anchorOffset === node.textContent!.length) {
        const text = node.textContent!;
        const rules: [string, () => void][] = [['#', () => setBlockType('h1')], ['##', () => setBlockType('h2')], ['###', () => setBlockType('h3')], ['-', () => exec('insertUnorderedList')], ['*', () => exec('insertUnorderedList')], ['1.', () => exec('insertOrderedList')], ['>', () => setBlockType('blockquote')], ['[]', () => insert('<ul class="kb-checklist"><li data-checked="false"><br></li></ul>')]];
        const rule = rules.find(([k]) => k === text);
        const parent = node.parentElement;
        if (rule && parent && (parent === box.current || /^(P|DIV)$/.test(parent.tagName))) {
          e.preventDefault();
          // Сначала меняем тип блока, потом убираем символы сокращения и ставим курсор в пустой блок.
          rule[1]();
          const after = document.getSelection();
          const textNode = after?.anchorNode?.nodeType === Node.TEXT_NODE ? after.anchorNode : node;
          const holder = textNode.parentElement;
          if (textNode.textContent === text) textNode.textContent = '';
          if (holder && after && !holder.textContent) {
            if (!holder.querySelector('br')) holder.append(document.createElement('br'));
            const r = document.createRange();
            r.setStart(holder, 0);
            r.collapse(true);
            after.removeAllRanges();
            after.addRange(r);
          }
          emit();
        }
      }
    }
  };

  const open = (p: Popup) => { refresh(); setInput(''); setPopup(popup === p ? null : p); };
  const kb = variant === 'kb';

  return (
    <div className={`re re-${variant}${readOnly ? ' is-read' : ''}`}>
      {!readOnly && (
        <div className="re-bar" role="toolbar" aria-label="Форматирование">
          <div className="re-row">
            <B name="undo" title="Отменить (Ctrl+Z)" onPress={() => exec('undo')} />
            <B name="redo" title="Повторить (Ctrl+Y)" onPress={() => exec('redo')} />
            <span className="re-sep" />
            <select className="re-select" aria-label="Стиль текста" value={block} onMouseDown={refresh} onChange={(e) => setBlockType(e.target.value)}>
              <option value="p">Обычный текст</option>
              <option value="h1">Заголовок 1</option>
              <option value="h2">Заголовок 2</option>
              <option value="h3">Заголовок 3</option>
              <option value="blockquote">Цитата</option>
              <option value="pre">Код</option>
            </select>
            <select className="re-select" aria-label="Шрифт" value="" onMouseDown={refresh} onChange={(e) => e.target.value && wrapStyle('fontFamily', e.target.value)}>
              <option value="">Шрифт</option>
              {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <select className="re-select is-short" aria-label="Размер" value="" onMouseDown={refresh} onChange={(e) => e.target.value && wrapStyle('fontSize', `${e.target.value}px`)}>
              <option value="">Размер</option>
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="re-sep" />
            <B name="bold" title="Жирный (Ctrl+B)" on={active.bold} onPress={() => exec('bold')} />
            <B name="italic" title="Курсив (Ctrl+I)" on={active.italic} onPress={() => exec('italic')} />
            <B name="underline" title="Подчёркнутый (Ctrl+U)" on={active.underline} onPress={() => exec('underline')} />
            <B name="strike" title="Зачёркнутый" on={active.strikeThrough} onPress={() => exec('strikeThrough')} />
            {!kb && <B name="sub" title="Нижний индекс" on={active.subscript} onPress={() => exec('subscript')} />}
            {!kb && <B name="sup" title="Верхний индекс" on={active.superscript} onPress={() => exec('superscript')} />}
            <span className="re-pop-wrap">
              <B name="color" title="Цвет текста" onPress={() => open('color')} />
              {popup === 'color' && <div className="re-pop re-swatches">{PALETTE.map((c) => <button key={c} type="button" style={{ background: c }} aria-label={`Цвет ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('foreColor', c); setPopup(null); }} />)}</div>}
            </span>
            <span className="re-pop-wrap">
              <B name="marker" title="Выделение цветом" onPress={() => open('marker')} />
              {popup === 'marker' && <div className="re-pop re-swatches">{HIGHLIGHT.map((c) => <button key={c} type="button" className={c === 'transparent' ? 'is-none' : ''} style={{ background: c }} aria-label={c === 'transparent' ? 'Без выделения' : `Выделение ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('hiliteColor', c); setPopup(null); }} />)}</div>}
            </span>
            {kb && <B name="clear" title="Очистить форматирование" onPress={() => { exec('removeFormat'); exec('unlink'); }} />}
          </div>
          <div className="re-row">
            <B name="left" title="По левому краю" onPress={() => exec('justifyLeft')} />
            <B name="center" title="По центру" on={active.justifyCenter} onPress={() => exec('justifyCenter')} />
            <B name="right" title="По правому краю" on={active.justifyRight} onPress={() => exec('justifyRight')} />
            {!kb && <B name="justify" title="По ширине" on={active.justifyFull} onPress={() => exec('justifyFull')} />}
            {!kb && <span className="re-sep" />}
            <B name="ul" title="Маркированный список" on={active.insertUnorderedList} onPress={() => exec('insertUnorderedList')} />
            <B name="ol" title="Нумерованный список" on={active.insertOrderedList} onPress={() => exec('insertOrderedList')} />
            {kb && <B name="check" title="Чек-лист" onPress={() => insert('<ul class="kb-checklist"><li data-checked="false"><br></li></ul>')} />}
            {!kb && <B name="outdent" title="Уменьшить отступ" onPress={() => exec('outdent')} />}
            {!kb && <B name="indent" title="Увеличить отступ" onPress={() => exec('indent')} />}
            <span className="re-sep" />
            <span className="re-pop-wrap">
              <B name="link" title="Ссылка (Ctrl+K)" onPress={() => open('link')} />
              {popup === 'link' && <form className="re-pop re-form" onSubmit={(e) => { e.preventDefault(); addLink(); }}><input autoFocus placeholder="https://…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Адрес ссылки" /><button type="submit">Вставить</button></form>}
            </span>
            {!kb && <B name="unlink" title="Убрать ссылку" onPress={() => exec('unlink')} />}
            {kb && <B name="file" title="Файл до 2 МБ" onPress={() => { refresh(); file.current?.click(); }} />}
            {kb && <B name="image" title="Изображение" onPress={() => { refresh(); image.current?.click(); }} />}
            {kb && (
              <span className="re-pop-wrap">
                <B name="page" title="Ссылка на страницу базы знаний" onPress={() => open('page')} />
                {popup === 'page' && (
                  <div className="re-pop re-list">
                    <input autoFocus placeholder="Найти страницу" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Найти страницу" />
                    {pages.filter((p) => p.title.toLowerCase().includes(input.toLowerCase())).slice(0, 12).map((p) => <button key={p.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(`<a class="kb-page-link" href="#" data-page="${esc(p.id)}">${esc(p.icon)} ${esc(p.title || 'Без названия')}</a>&nbsp;`)}>{p.icon} {p.title || 'Без названия'}</button>)}
                    {!pages.length && <small>В пространстве пока нет других страниц.</small>}
                  </div>
                )}
              </span>
            )}
            {kb && (
              <span className="re-pop-wrap">
                <B name="table" title="Таблица" onPress={() => open('table')} />
                {popup === 'table' && (
                  <div className="re-pop re-form re-table-form">
                    <label>Строк <input type="number" min={1} max={30} value={table.rows} onChange={(e) => setTable({ ...table, rows: Math.max(1, Math.min(30, +e.target.value || 1)) })} /></label>
                    <label>Столбцов <input type="number" min={1} max={10} value={table.cols} onChange={(e) => setTable({ ...table, cols: Math.max(1, Math.min(10, +e.target.value || 1)) })} /></label>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addTable()}>Вставить</button>
                  </div>
                )}
              </span>
            )}
            {kb && <B name="database" title="Таблица-база с заголовками полей" onPress={() => { refresh(); addTable(true); }} />}
            {!kb && <B name="divider" title="Разделитель" onPress={() => insert('<hr><p><br></p>')} />}
            {!kb && <B name="clear" title="Очистить форматирование" onPress={() => exec('removeFormat')} />}
          </div>
          <div className="re-row">
            {kb && <B name="callout" title="Выноска" onPress={() => insert('<div class="kb-callout is-info" data-kb-block="callout"><p>💡 <br></p></div><p><br></p>')} />}
            {kb && <B name="mention" title="Упоминание" onPress={() => insert(`<span class="kb-mention" data-mention="${esc(author)}">@${esc(author)}</span>&nbsp;`)} />}
            {kb && <B name="quote" title="Цитата" onPress={() => setBlockType('blockquote')} />}
            {kb && <B name="toggle" title="Раскрывающийся блок" onPress={() => insert('<details class="kb-toggle" open><summary>Заголовок блока</summary><p><br></p></details><p><br></p>')} />}
            {kb && <B name="columns" title="Две колонки" onPress={() => insert('<div class="kb-columns" data-kb-block="columns"><div><p><br></p></div><div><p><br></p></div></div><p><br></p>')} />}
            {kb && <B name="code" title="Блок кода" onPress={() => setBlockType('pre')} />}
            {kb && (
              <span className="re-pop-wrap">
                <B name="video" title="Видео по ссылке" onPress={() => open('video')} />
                {popup === 'video' && <form className="re-pop re-form" onSubmit={(e) => { e.preventDefault(); addVideo(); }}><input autoFocus placeholder="Ссылка YouTube, Rutube, VK" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Ссылка на видео" /><button type="submit">Вставить</button></form>}
              </span>
            )}
            {kb && <B name="divider" title="Разделитель" onPress={() => insert('<hr><p><br></p>')} />}
            {kb && (
              <span className="re-pop-wrap">
                <B name="emoji" title="Эмодзи" onPress={() => open('emoji')} />
                {popup === 'emoji' && <div className="re-pop re-emoji">{EMOJI.map((em) => <button key={em} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(em)}>{em}</button>)}</div>}
              </span>
            )}
            {kb && status && <span className="re-status">{status}</span>}
          </div>
        </div>
      )}
      <div
        ref={box}
        className="re-content kb-prose"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={variant === 'kb' ? 'Текст статьи' : 'Текст заметки'}
        aria-readonly={readOnly}
        data-placeholder={placeholder}
        spellCheck
        onInput={emit}
        onBlur={emit}
        onClick={onClick}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onFocus={() => setPopup(null)}
      />
      {footer}
      <input ref={image} type="file" accept="image/*" hidden onChange={(e) => { void onImage(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={file} type="file" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

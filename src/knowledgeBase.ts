/**
 * База знаний в духе Teamly: пространства (по одному на каждую сферу жизни и свои),
 * вложенные статьи, статусы, избранное, архив, корзина, история версий, комментарии,
 * глоссарий, быстрые ссылки и шаблоны. Данные лежат в браузере (localStorage) отдельно
 * для каждого владельца и не входят в игровое сохранение — синхронизация между устройствами
 * требует отдельного согласования структуры сохранений.
 */

export type KbStatus = 'draft' | 'published';
export type KbQuickLink = { id: string; title: string; url: string };
export type KbSpace = {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Пространство сферы жизни: создаётся автоматически и не удаляется. */
  sphereId?: string;
  description: string;
  quickLinks: KbQuickLink[];
  createdAt: string;
  archivedAt?: string;
};
export type KbVersion = { id: string; at: string; title: string; html: string; author: string };
export type KbComment = { id: string; text: string; at: string; author: string; parentId?: string; resolved?: boolean };
export type KbArticle = {
  id: string;
  spaceId: string;
  /** null — статья верхнего уровня; страница пространства — сама сущность KbSpace. */
  parentId: string | null;
  title: string;
  icon: string;
  cover?: string;
  html: string;
  status: KbStatus;
  tags: string[];
  favorite: boolean;
  fullWidth?: boolean;
  /** Статья закреплена от правок, пока замок не снят. */
  locked?: boolean;
  /** Отдельная вкладка браузера — вкладка «Вкладка» в Teamly; здесь: показывать как вкладку пространства. */
  pinnedTab?: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  author: string;
  views: number;
  versions: KbVersion[];
  comments: KbComment[];
  archivedAt?: string;
  deletedAt?: string;
};
export type KbTerm = { id: string; spaceId: string; term: string; definition: string; updatedAt: string };
export type KnowledgeBase = { version: 1; spaces: KbSpace[]; articles: KbArticle[]; glossary: KbTerm[]; recent: string[] };

export const KB_TRASH_DAYS = 30;
export const KB_MAX_VERSIONS = 40;
export const KB_TITLE_MAX = 200;
const DAY = 86_400_000;

let counter = 0;
export function kbId(prefix = 'kb'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${random}${counter}`;
}

type SphereLike = { id: string; name: string; icon: string; color: string };

export function emptyKnowledgeBase(spheres: SphereLike[] = [], now = new Date()): KnowledgeBase {
  return ensureSphereSpaces({ version: 1, spaces: [], articles: [], glossary: [], recent: [] }, spheres, now);
}

/** Пространство для каждой сферы жизни. Пользовательские данные не трогаются. */
export function ensureSphereSpaces(kb: KnowledgeBase, spheres: SphereLike[], now = new Date()): KnowledgeBase {
  const missing = spheres.filter((s) => !kb.spaces.some((space) => space.sphereId === s.id));
  if (!missing.length) return kb;
  const created = missing.map<KbSpace>((s) => ({ id: `space-${s.id}`, name: s.name, icon: s.icon, color: s.color, sphereId: s.id, description: '', quickLinks: [], createdAt: now.toISOString() }));
  const order = spheres.map((s) => s.id);
  const spaces = [...kb.spaces, ...created].sort((a, b) => {
    const ai = a.sphereId ? order.indexOf(a.sphereId) : 999;
    const bi = b.sphereId ? order.indexOf(b.sphereId) : 999;
    return ai - bi;
  });
  return { ...kb, spaces };
}

export function spaceOfSphere(kb: KnowledgeBase, sphereId: string): KbSpace | undefined {
  return kb.spaces.find((s) => s.sphereId === sphereId);
}

export function addSpace(kb: KnowledgeBase, input: { name: string; icon?: string; color?: string; description?: string }, now = new Date()): [KnowledgeBase, KbSpace] {
  const space: KbSpace = { id: kbId('space'), name: input.name.trim().slice(0, 80) || 'Новое пространство', icon: input.icon || '📘', color: input.color || '#2f7be8', description: input.description?.trim() ?? '', quickLinks: [], createdAt: now.toISOString() };
  return [{ ...kb, spaces: [...kb.spaces, space] }, space];
}

export function updateSpace(kb: KnowledgeBase, id: string, patch: Partial<Omit<KbSpace, 'id' | 'sphereId'>>): KnowledgeBase {
  return { ...kb, spaces: kb.spaces.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** Удалить можно только своё пространство; его статьи уходят в корзину вместе с ним. */
export function removeSpace(kb: KnowledgeBase, id: string): KnowledgeBase {
  const space = kb.spaces.find((s) => s.id === id);
  if (!space || space.sphereId) return kb;
  return { ...kb, spaces: kb.spaces.filter((s) => s.id !== id), articles: kb.articles.filter((a) => a.spaceId !== id), glossary: kb.glossary.filter((t) => t.spaceId !== id), recent: kb.recent.filter((r) => kb.articles.find((a) => a.id === r)?.spaceId !== id) };
}

export const isAlive = (a: KbArticle) => !a.deletedAt && !a.archivedAt;

export function childrenOf(kb: KnowledgeBase, spaceId: string, parentId: string | null, filter: (a: KbArticle) => boolean = isAlive): KbArticle[] {
  return kb.articles.filter((a) => a.spaceId === spaceId && a.parentId === parentId && filter(a)).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export function descendantIds(kb: KnowledgeBase, id: string): string[] {
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const a of kb.articles) if (a.parentId === parent && !out.includes(a.id)) { out.push(a.id); walk(a.id); }
  };
  walk(id);
  return out;
}

export function breadcrumbs(kb: KnowledgeBase, id: string): KbArticle[] {
  const chain: KbArticle[] = [];
  let current = kb.articles.find((a) => a.id === id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId ? kb.articles.find((a) => a.id === current!.parentId) : undefined;
  }
  return chain;
}

export type KbTemplate = { id: string; name: string; icon: string; description: string; html: string };
export const kbTemplates: KbTemplate[] = [
  { id: 'blank', name: 'Пустая страница', icon: '📄', description: 'Начать с чистого листа', html: '' },
  { id: 'regulation', name: 'Регламент', icon: '📋', description: 'Цель, область, порядок действий и ответственность', html: '<h2>Цель</h2><p><br></p><h2>Область применения</h2><p><br></p><h2>Порядок действий</h2><ol><li><br></li></ol><h2>Ответственность</h2><p><br></p><h2>Сроки пересмотра</h2><p><br></p>' },
  { id: 'instruction', name: 'Инструкция', icon: '🧭', description: 'Пошаговое руководство', html: '<h2>Что понадобится</h2><ul><li><br></li></ul><h2>Шаги</h2><ol><li><br></li></ol><div class="kb-callout is-info" data-kb-block="callout"><p>Совет: </p></div><h2>Частые ошибки</h2><ul><li><br></li></ul>' },
  { id: 'meeting', name: 'Встреча', icon: '🗓️', description: 'Повестка, решения и задачи', html: '<h2>Повестка</h2><ul><li><br></li></ul><h2>Обсуждение</h2><p><br></p><h2>Решения</h2><ul><li><br></li></ul><h2>Задачи</h2><ul class="kb-checklist"><li data-checked="false"><br></li></ul>' },
  { id: 'project', name: 'Проект', icon: '🚀', description: 'Цель, результат, этапы и риски', html: '<h2>Цель</h2><p><br></p><h2>Ожидаемый результат</h2><p><br></p><h2>Этапы</h2><table class="kb-table"><tbody><tr><th>Этап</th><th>Срок</th><th>Статус</th></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table><h2>Риски</h2><ul><li><br></li></ul>' },
  { id: 'faq', name: 'Вопросы и ответы', icon: '❓', description: 'Частые вопросы с раскрывающимися ответами', html: '<h2>Вопросы и ответы</h2><details class="kb-toggle"><summary>Вопрос</summary><p>Ответ</p></details>' },
  { id: 'checklist', name: 'Чек-лист', icon: '✅', description: 'Список проверок', html: '<h2>Чек-лист</h2><ul class="kb-checklist"><li data-checked="false"><br></li></ul>' },
  { id: 'journal', name: 'Дневник', icon: '📓', description: 'Запись дня: события, мысли, выводы', html: '<h2>Что произошло</h2><p><br></p><h2>Мысли</h2><p><br></p><h2>Выводы</h2><p><br></p>' },
];

export function createArticle(kb: KnowledgeBase, input: { spaceId: string; parentId?: string | null; title?: string; templateId?: string; author: string; icon?: string }, now = new Date()): [KnowledgeBase, KbArticle] {
  const template = kbTemplates.find((t) => t.id === input.templateId) ?? kbTemplates[0];
  const parentId = input.parentId ?? null;
  const siblings = childrenOf(kb, input.spaceId, parentId, () => true);
  const at = now.toISOString();
  const article: KbArticle = {
    id: kbId('page'), spaceId: input.spaceId, parentId, title: (input.title ?? (template.id === 'blank' ? '' : template.name)).slice(0, KB_TITLE_MAX), icon: input.icon ?? (template.id === 'blank' ? '📄' : template.icon),
    html: template.html, status: 'draft', tags: [], favorite: false, order: siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0,
    createdAt: at, updatedAt: at, author: input.author, views: 0, versions: [], comments: [],
  };
  return [{ ...kb, articles: [...kb.articles, article] }, article];
}

/**
 * Изменение статьи. Если меняются текст или заголовок, предыдущее состояние сохраняется в историю —
 * не чаще одного снимка в 5 минут, чтобы автосохранение при наборе не засоряло историю.
 */
export function updateArticle(kb: KnowledgeBase, id: string, patch: Partial<Omit<KbArticle, 'id' | 'versions' | 'comments'>>, options: { author?: string; now?: Date; snapshot?: boolean } = {}): KnowledgeBase {
  const now = options.now ?? new Date();
  return {
    ...kb,
    articles: kb.articles.map((a) => {
      if (a.id !== id) return a;
      const contentChanged = (patch.html !== undefined && patch.html !== a.html) || (patch.title !== undefined && patch.title !== a.title);
      let versions = a.versions;
      if (contentChanged && (a.html || a.title)) {
        const last = versions[versions.length - 1];
        const stale = !last || now.getTime() - new Date(last.at).getTime() > 5 * 60_000;
        if (options.snapshot || stale) versions = [...versions, { id: kbId('ver'), at: a.updatedAt, title: a.title, html: a.html, author: options.author ?? a.author }].slice(-KB_MAX_VERSIONS);
      }
      const title = patch.title !== undefined ? patch.title.slice(0, KB_TITLE_MAX) : a.title;
      const meta = contentChanged || patch.status !== undefined || patch.tags !== undefined || patch.icon !== undefined || patch.cover !== undefined;
      return { ...a, ...patch, title, versions, updatedAt: meta ? now.toISOString() : a.updatedAt };
    }),
  };
}

export function restoreVersion(kb: KnowledgeBase, id: string, versionId: string, author: string, now = new Date()): KnowledgeBase {
  const article = kb.articles.find((a) => a.id === id);
  const version = article?.versions.find((v) => v.id === versionId);
  if (!article || !version) return kb;
  return updateArticle(kb, id, { title: version.title, html: version.html }, { author, now, snapshot: true });
}

export function moveArticle(kb: KnowledgeBase, id: string, target: { spaceId?: string; parentId: string | null; index?: number }): KnowledgeBase {
  const article = kb.articles.find((a) => a.id === id);
  if (!article) return kb;
  if (target.parentId === id || (target.parentId && descendantIds(kb, id).includes(target.parentId))) return kb;
  const spaceId = target.spaceId ?? (target.parentId ? kb.articles.find((a) => a.id === target.parentId)?.spaceId : undefined) ?? article.spaceId;
  const moved = new Set([id, ...descendantIds(kb, id)]);
  const siblings = childrenOf(kb, spaceId, target.parentId, () => true).filter((a) => a.id !== id);
  const index = Math.max(0, Math.min(target.index ?? siblings.length, siblings.length));
  siblings.splice(index, 0, { ...article, spaceId, parentId: target.parentId });
  const orders = new Map(siblings.map((a, i) => [a.id, i]));
  return {
    ...kb,
    articles: kb.articles.map((a) => {
      if (a.id === id) return { ...a, spaceId, parentId: target.parentId, order: orders.get(a.id)! };
      if (moved.has(a.id)) return { ...a, spaceId };
      return orders.has(a.id) ? { ...a, order: orders.get(a.id)! } : a;
    }),
  };
}

export function duplicateArticle(kb: KnowledgeBase, id: string, author: string, withChildren = true, now = new Date()): [KnowledgeBase, KbArticle | undefined] {
  const source = kb.articles.find((a) => a.id === id);
  if (!source) return [kb, undefined];
  const at = now.toISOString();
  const map = new Map<string, string>();
  const ids = withChildren ? [id, ...descendantIds(kb, id).filter((d) => isAlive(kb.articles.find((a) => a.id === d)!))] : [id];
  for (const old of ids) map.set(old, kbId('page'));
  const copies = ids.map((old) => {
    const a = kb.articles.find((x) => x.id === old)!;
    return { ...a, id: map.get(old)!, parentId: old === id ? a.parentId : map.get(a.parentId!) ?? a.parentId, title: old === id ? `${a.title || 'Без названия'} (копия)`.slice(0, KB_TITLE_MAX) : a.title, order: old === id ? a.order + 0.5 : a.order, favorite: false, status: 'draft' as const, views: 0, versions: [], comments: [], createdAt: at, updatedAt: at, author };
  });
  const next = { ...kb, articles: [...kb.articles, ...copies] };
  const first = copies[0];
  return [moveArticle(next, first.id, { parentId: first.parentId, index: childrenOf(next, first.spaceId, first.parentId, () => true).findIndex((a) => a.id === first.id) }), first];
}

/** В архив и в корзину статья уходит вместе с вложенными страницами. */
function markTree(kb: KnowledgeBase, id: string, field: 'archivedAt' | 'deletedAt', value: string | undefined): KnowledgeBase {
  const ids = new Set([id, ...descendantIds(kb, id)]);
  return { ...kb, articles: kb.articles.map((a) => (ids.has(a.id) ? { ...a, [field]: value } : a)) };
}
export const archiveArticle = (kb: KnowledgeBase, id: string, now = new Date()) => markTree(kb, id, 'archivedAt', now.toISOString());
export const unarchiveArticle = (kb: KnowledgeBase, id: string) => detachIfOrphan(markTree(kb, id, 'archivedAt', undefined), id);
export const trashArticle = (kb: KnowledgeBase, id: string, now = new Date()) => markTree(kb, id, 'deletedAt', now.toISOString());
export const restoreArticle = (kb: KnowledgeBase, id: string) => detachIfOrphan(markTree(kb, id, 'deletedAt', undefined), id);

/** Если родитель восстановленной статьи остаётся в корзине или архиве, статья поднимается на верхний уровень. */
function detachIfOrphan(kb: KnowledgeBase, id: string): KnowledgeBase {
  const a = kb.articles.find((x) => x.id === id);
  const parent = a?.parentId ? kb.articles.find((x) => x.id === a.parentId) : undefined;
  if (!a || !a.parentId || (parent && isAlive(parent))) return kb;
  return moveArticle(kb, id, { parentId: null, spaceId: a.spaceId });
}

export function deleteForever(kb: KnowledgeBase, id: string): KnowledgeBase {
  const ids = new Set([id, ...descendantIds(kb, id)]);
  return { ...kb, articles: kb.articles.filter((a) => !ids.has(a.id)), recent: kb.recent.filter((r) => !ids.has(r)) };
}

export function purgeTrash(kb: KnowledgeBase, now = new Date(), days = KB_TRASH_DAYS): KnowledgeBase {
  const old = kb.articles.filter((a) => a.deletedAt && now.getTime() - new Date(a.deletedAt).getTime() > days * DAY);
  return old.reduce((acc, a) => deleteForever(acc, a.id), kb);
}

export function emptyTrash(kb: KnowledgeBase, spaceId?: string): KnowledgeBase {
  return kb.articles.filter((a) => a.deletedAt && (!spaceId || a.spaceId === spaceId)).reduce((acc, a) => deleteForever(acc, a.id), kb);
}

export function markViewed(kb: KnowledgeBase, id: string): KnowledgeBase {
  return { ...kb, articles: kb.articles.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)), recent: [id, ...kb.recent.filter((r) => r !== id)].slice(0, 20) };
}

export function addComment(kb: KnowledgeBase, id: string, text: string, author: string, parentId?: string, now = new Date()): KnowledgeBase {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return kb;
  return { ...kb, articles: kb.articles.map((a) => (a.id === id ? { ...a, comments: [...a.comments, { id: kbId('cmt'), text: clean, at: now.toISOString(), author, parentId }] } : a)) };
}
export function updateComment(kb: KnowledgeBase, id: string, commentId: string, patch: Partial<Pick<KbComment, 'text' | 'resolved'>> | null): KnowledgeBase {
  return {
    ...kb,
    articles: kb.articles.map((a) => (a.id !== id ? a : { ...a, comments: patch === null ? a.comments.filter((c) => c.id !== commentId && c.parentId !== commentId) : a.comments.map((c) => (c.id === commentId ? { ...c, ...patch } : c)) })),
  };
}

export function saveTerm(kb: KnowledgeBase, term: { id?: string; spaceId: string; term: string; definition: string }, now = new Date()): KnowledgeBase {
  const clean = { term: term.term.trim().slice(0, 120), definition: term.definition.trim().slice(0, 2000) };
  if (!clean.term) return kb;
  if (term.id && kb.glossary.some((t) => t.id === term.id)) return { ...kb, glossary: kb.glossary.map((t) => (t.id === term.id ? { ...t, ...clean, updatedAt: now.toISOString() } : t)) };
  return { ...kb, glossary: [...kb.glossary, { id: kbId('term'), spaceId: term.spaceId, ...clean, updatedAt: now.toISOString() }] };
}
export const removeTerm = (kb: KnowledgeBase, id: string): KnowledgeBase => ({ ...kb, glossary: kb.glossary.filter((t) => t.id !== id) });

const entities: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/summary|\/blockquote|\/pre)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => entities[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function wordCount(html: string): { words: number; chars: number } {
  const text = htmlToText(html);
  return { words: text ? text.split(/\s+/).filter(Boolean).length : 0, chars: text.replace(/\n/g, '').length };
}

export type KbHeading = { level: number; text: string; index: number };
export function tableOfContents(html: string): KbHeading[] {
  const out: KbHeading[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  let index = 0;
  while ((m = re.exec(html))) {
    const text = htmlToText(m[2]);
    if (text) out.push({ level: Number(m[1]), text, index });
    index += 1;
  }
  return out;
}

export type KbHit = { article: KbArticle; snippet: string };
export function searchArticles(kb: KnowledgeBase, query: string, spaceId?: string): KbHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return kb.articles
    .filter((a) => isAlive(a) && (!spaceId || a.spaceId === spaceId))
    .map((a) => {
      const text = htmlToText(a.html);
      const inTitle = a.title.toLowerCase().includes(q);
      const at = text.toLowerCase().indexOf(q);
      const inTags = a.tags.some((t) => t.toLowerCase().includes(q));
      if (!inTitle && at < 0 && !inTags) return null;
      const snippet = at >= 0 ? `${at > 40 ? '…' : ''}${text.slice(Math.max(0, at - 40), at + q.length + 60).replace(/\s+/g, ' ')}` : text.slice(0, 100);
      return { article: a, snippet, rank: inTitle ? 0 : inTags ? 1 : 2 };
    })
    .filter((x): x is KbHit & { rank: number } => !!x)
    .sort((a, b) => a.rank - b.rank || b.article.updatedAt.localeCompare(a.article.updatedAt))
    .map(({ article, snippet }) => ({ article, snippet }));
}

export function spaceAnalytics(kb: KnowledgeBase, spaceId: string, now = new Date()) {
  const all = kb.articles.filter((a) => a.spaceId === spaceId);
  const alive = all.filter(isAlive);
  const week = now.getTime() - 7 * DAY;
  return {
    total: alive.length,
    published: alive.filter((a) => a.status === 'published').length,
    drafts: alive.filter((a) => a.status === 'draft').length,
    archived: all.filter((a) => a.archivedAt && !a.deletedAt).length,
    trashed: all.filter((a) => a.deletedAt).length,
    views: alive.reduce((s, a) => s + a.views, 0),
    comments: alive.reduce((s, a) => s + a.comments.length, 0),
    words: alive.reduce((s, a) => s + wordCount(a.html).words, 0),
    updatedWeek: alive.filter((a) => new Date(a.updatedAt).getTime() >= week).length,
    top: [...alive].sort((a, b) => b.views - a.views).slice(0, 5),
    stale: [...alive].filter((a) => now.getTime() - new Date(a.updatedAt).getTime() > 90 * DAY).slice(0, 5),
    recent: [...alive].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
  };
}

/** Простое преобразование HTML статьи в Markdown для экспорта. */
export function htmlToMarkdown(title: string, html: string): string {
  let md = html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => `\n${'#'.repeat(Number(l))} ${htmlToText(t)}\n`)
    .replace(/<li[^>]*data-checked="true"[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- [x] ${htmlToText(t)}\n`)
    .replace(/<li[^>]*data-checked="false"[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- [ ] ${htmlToText(t)}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${htmlToText(t)}\n`)
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img [^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\n\`\`\`\n${htmlToText(t)}\n\`\`\`\n`);
  md = htmlToText(md.replace(/<\/p>/gi, '\n\n'));
  return `# ${title || 'Без названия'}\n\n${md}\n`;
}

// ── Хранение ────────────────────────────────────────────────────────────────

export const kbStorageKey = (owner: string) => `pyl-knowledge-v1:${owner}`;

function validArticle(a: unknown): a is KbArticle {
  if (!a || typeof a !== 'object') return false;
  const x = a as KbArticle;
  return typeof x.id === 'string' && typeof x.spaceId === 'string' && typeof x.title === 'string' && typeof x.html === 'string' && (x.parentId === null || typeof x.parentId === 'string');
}

/** Разбор сохранённых данных с мягким восстановлением: битые записи отбрасываются, а не ломают раздел. */
export function parseKnowledgeBase(raw: string | null, spheres: SphereLike[], now = new Date()): KnowledgeBase {
  if (!raw) return emptyKnowledgeBase(spheres, now);
  try {
    const data = JSON.parse(raw) as Partial<KnowledgeBase>;
    const spaces = Array.isArray(data.spaces) ? data.spaces.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string').map((s) => ({ ...s, quickLinks: Array.isArray(s.quickLinks) ? s.quickLinks : [], description: s.description ?? '' })) : [];
    const articles = Array.isArray(data.articles)
      ? data.articles.filter(validArticle).map((a) => ({ ...a, tags: Array.isArray(a.tags) ? a.tags : [], versions: Array.isArray(a.versions) ? a.versions : [], comments: Array.isArray(a.comments) ? a.comments : [], views: Number(a.views) || 0, order: Number(a.order) || 0, status: a.status === 'published' ? ('published' as const) : ('draft' as const), icon: a.icon || '📄' }))
      : [];
    const glossary = Array.isArray(data.glossary) ? data.glossary.filter((t) => t && typeof t.term === 'string') : [];
    const recent = Array.isArray(data.recent) ? data.recent.filter((r) => typeof r === 'string') : [];
    return purgeTrash(ensureSphereSpaces({ version: 1, spaces, articles, glossary, recent }, spheres, now), now);
  } catch {
    return emptyKnowledgeBase(spheres, now);
  }
}

/** Импорт: добавляет пространства, статьи и термины, которых ещё нет (по id); существующие не перезаписываются. */
export function mergeKnowledgeBase(kb: KnowledgeBase, incoming: KnowledgeBase): { kb: KnowledgeBase; added: number } {
  const spaceIds = new Set(kb.spaces.map((s) => s.id));
  const sphereSpace = new Map(kb.spaces.filter((s) => s.sphereId).map((s) => [s.sphereId!, s.id]));
  // Пространство сферы из файла совпадает с пространством той же сферы здесь.
  const remap = new Map<string, string>();
  const spaces = [...kb.spaces];
  for (const s of incoming.spaces) {
    if (s.sphereId && sphereSpace.has(s.sphereId)) remap.set(s.id, sphereSpace.get(s.sphereId)!);
    else if (!spaceIds.has(s.id)) { spaces.push(s); spaceIds.add(s.id); }
  }
  const articleIds = new Set(kb.articles.map((a) => a.id));
  const fresh = incoming.articles.filter((a) => !articleIds.has(a.id)).map((a) => ({ ...a, spaceId: remap.get(a.spaceId) ?? a.spaceId })).filter((a) => spaceIds.has(a.spaceId) || [...remap.values()].includes(a.spaceId));
  const termIds = new Set(kb.glossary.map((t) => t.id));
  const terms = incoming.glossary.filter((t) => !termIds.has(t.id)).map((t) => ({ ...t, spaceId: remap.get(t.spaceId) ?? t.spaceId }));
  return { kb: { ...kb, spaces, articles: [...kb.articles, ...fresh], glossary: [...kb.glossary, ...terms] }, added: fresh.length };
}

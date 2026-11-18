/** Очистка и подготовка HTML для редактора статей и заметок. */
const ALLOWED = new Set(['P', 'DIV', 'SPAN', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUB', 'SUP', 'A', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'DETAILS', 'SUMMARY', 'FONT', 'MARK', 'IFRAME', 'FIGURE', 'FIGCAPTION']);
const DROP = new Set(['SCRIPT', 'STYLE', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'NOSCRIPT', 'TEMPLATE', 'BASE']);
const ATTRS = new Set(['href', 'src', 'alt', 'title', 'style', 'class', 'colspan', 'rowspan', 'data-checked', 'data-kb-block', 'data-page', 'data-mention', 'download', 'target', 'rel', 'color', 'face', 'size', 'open', 'allowfullscreen', 'width', 'height']);
const VIDEO_HOSTS = /^https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/|rutube\.ru\/play\/embed\/|vk\.com\/video_ext\.php|vkvideo\.ru\/video_ext\.php|player\.vimeo\.com\/video\/)/;
const safeUrl = (url: string, kind: 'href' | 'src') => {
  const v = url.trim();
  if (/^(https?:|mailto:|tel:|#)/i.test(v)) return true;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) return true;
  return kind === 'href' && /^data:[\w.+-]+\/[\w.+-]+;base64,/i.test(v);
};

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (DROP.has(child.tagName)) { child.remove(); continue; }
      if (!ALLOWED.has(child.tagName)) { walk(child); child.replaceWith(...child.childNodes); continue; }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        if (!ATTRS.has(name) || ((name === 'href' || name === 'src') && !safeUrl(attr.value, name)) || (name === 'style' && /url\(|expression|javascript/i.test(attr.value))) child.removeAttribute(attr.name);
      }
      if (child.tagName === 'IFRAME' && !VIDEO_HOSTS.test(child.getAttribute('src') ?? '')) { child.remove(); continue; }
      if (child.tagName === 'A') child.setAttribute('rel', 'noopener noreferrer');
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function videoEmbedUrl(url: string): string | null {
  const v = url.trim();
  let m = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  m = v.match(/rutube\.ru\/video\/([\w]+)/);
  if (m) return `https://rutube.ru/play/embed/${m[1]}`;
  m = v.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  m = v.match(/vk(?:video)?\.(?:com|ru)\/video(-?\d+)_(\d+)/);
  if (m) return `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}`;
  return VIDEO_HOSTS.test(v) ? v : null;
}

/** Уменьшает фото до 1600 px по длинной стороне, чтобы статья помещалась в хранилище браузера. */
export function readImage(file: File, max = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === 'image/gif' || file.size < 200_000) { resolve(src); return; }
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * k);
        canvas.height = Math.round(img.height * k);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Формат изображения не поддерживается.'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export const MAX_ATTACHMENT = 2 * 1024 * 1024;
export const readFile = (file: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Не удалось прочитать файл.')); r.readAsDataURL(file); });


export const EMOJI = ['😀', '😁', '😂', '🙂', '😉', '😍', '🤩', '🤑', '😎', '🤔', '😴', '🥳', '👍', '👎', '👏', '🙏', '💪', '🔥', '⭐', '✅', '❌', '⚠️', '💡', '📌', '📎', '📚', '📝', '📊', '📈', '💰', '❤️', '🏃', '🧘', '🍎', '🏠', '✈️', '🎯', '🚀', '🎉', '🧠'];

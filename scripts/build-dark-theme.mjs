// Тёмная тема для всего приложения. Скрипт читает стили страниц и создаёт
// src/theme-dark.generated.css: те же селекторы под :root[data-theme="dark"],
// где светлые фоны становятся тёмно-синими, а тёмный текст — светлым.
// Яркие акцентные цвета, картинки и игровые иллюстрации не меняются.
// Ручные уточнения — в src/theme-dark.css. Запуск: npm run theme:dark
import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { log } from 'node:console';

const root = new URL('../src/', import.meta.url);
const sources = [
  'styles.css',
  'interface.css',
  'account.css',
  'selection.css',
  'components/AdaptiveLayout.css',
  'components/DataBackup.css',
  'components/GoalWorkspace.css',
  'components/GoalsOverview.css',
  'components/LifeCity.css',
  'components/ProjectCompletionDialog.css',
  'components/ProjectImagePicker.css',
  'components/QuestBoard.css',
  'components/RewardShop.css',
  'components/SphereCity.css',
  'components/SpheresOverview.css',
  'components/Statistics.css',
];
// Компоненты со своей светлой и тёмной темой: главная, меню и дерево навыков.
const ownTheme = /data-theme|\.home-dashboard|\.home-|\.pyl-menu|\.pyl-tabbar|\.pyl-more|\.pyl-theme|\.skt\b/;
const scope = ':root[data-theme="dark"]';

/* ---------- цвета ---------- */
const named = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], whitesmoke: [245, 245, 245, 1], ghostwhite: [248, 248, 255, 1], aliceblue: [240, 248, 255, 1], snow: [255, 250, 250, 1] };
const colorToken = /#[0-9a-fA-F]{3,8}\b|rgba?\([^()]*\)|hsla?\([^()]*\)|\b(?:white|black|whitesmoke|ghostwhite|aliceblue|snow)\b/g;

function parseColor(token) {
  const t = token.toLowerCase();
  if (named[t]) return [...named[t]];
  if (t.startsWith('#')) {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const parts = t.replace(/^[a-z]+\(|\)$/g, '').split(/[\s,/]+/).filter(Boolean);
  const num = (v, scale) => (v.endsWith('%') ? (parseFloat(v) / 100) * scale : parseFloat(v));
  if (parts.length < 3 || parts.some((p) => Number.isNaN(parseFloat(p)))) return null;
  const alpha = parts[3] === undefined ? 1 : num(parts[3], 1);
  if (t.startsWith('rgb')) return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
  const [r, g, b] = hslToRgb(parseFloat(parts[0]) / 360, num(parts[1], 1), num(parts[2], 1));
  return [r, g, b, alpha];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const hex = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
function format(h, s, l, a) {
  const [r, g, b] = hslToRgb(h, s, l);
  return '#' + hex(r) + hex(g) + hex(b) + (a < 0.999 ? hex(a * 255) : '');
}

const navy = 224 / 360;
// Светлые поверхности → тёмно-синие (как на тёмной главной); акценты остаются.
const chroma = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
// Полупрозрачные светлые слои лежат на цветных карточках — их не трогаем.
function surface([r, g, b, a]) {
  const [h, s, l] = rgbToHsl(r, g, b), c = chroma(r, g, b);
  if (a < 0.5) return null;
  if (l >= 0.8) {
    const t = (l - 0.8) / 0.2;
    return c < 0.08 || l > 0.975 ? format(navy, 0.42, 0.1 + t * 0.04, a) : format(h, Math.min(s, 0.7) * 0.6, 0.15 + t * 0.04, a);
  }
  if (l >= 0.55 && c < 0.2) return format(c < 0.06 ? navy : h, 0.3, 0.2 + (l - 0.55) * 0.3, a);
  return null;
}
// Тёмный текст → светлый; светлый и цветной средней яркости остаётся.
function ink([r, g, b, a]) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l > 0.5) return null;
  if (chroma(r, g, b) < 0.25) return format(222 / 360, 0.45, 1 - l * 0.65, a);
  return format(h, Math.min(1, s), Math.max(0.7, 0.62 + l * 0.35), a);
}
function line([r, g, b, a]) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 0.72 || a < 0.5) return null;
  return chroma(r, g, b) < 0.06 ? format(navy, 0.35, 0.22 + (1 - l) * 0.35, a) : format(h, Math.min(s, 0.7) * 0.55, 0.3, a);
}
// Тени: тёмные чуть плотнее, светлые блики — тёмными.
function shade(c) {
  const [, , l] = rgbToHsl(c[0], c[1], c[2]);
  if (l < 0.45) return null;
  return surface(c);
}

function roleOf(prop) {
  if (prop === 'color' || prop === 'caret-color' || prop === '-webkit-text-fill-color' || prop === 'text-decoration-color') return ink;
  if (prop === 'background' || prop === 'background-color' || prop === 'background-image') return surface;
  if (prop.startsWith('border') || prop.startsWith('outline') || prop === 'column-rule') return line;
  if (prop === 'box-shadow' || prop === 'text-shadow') return shade;
  if (prop.startsWith('--')) {
    if (/bg|surface|panel|card|paper|background|fill|soft|tint/.test(prop)) return surface;
    if (/border|line|stroke|divider/.test(prop)) return line;
    if (/text|ink|muted|fg|title|label|color/.test(prop)) return ink;
    return (c) => {
      const l = rgbToHsl(c[0], c[1], c[2])[2];
      return l >= 0.8 ? surface(c) : l < 0.4 ? ink(c) : null;
    };
  }
  return null;
}

function convertValue(prop, value) {
  const role = roleOf(prop);
  if (!role || /url\(/.test(value) && !/gradient/.test(value)) return null;
  let changed = false;
  const out = value.replace(colorToken, (token) => {
    const c = parseColor(token);
    if (!c || c[3] === 0) return token;
    const next = role(c);
    if (!next) return token;
    changed = true;
    return next;
  });
  return changed ? out : null;
}

// В правиле есть яркий фон, который тема не меняет (жёлтая кнопка, цветная плашка).
function hasKeptLightFill(body) {
  return splitTop(body, ';').some((raw) => {
    const colon = raw.indexOf(':');
    const prop = raw.slice(0, colon).trim().toLowerCase();
    if (colon === -1 || !['background', 'background-color', 'background-image'].includes(prop)) return false;
    const colors = (raw.slice(colon + 1).match(colorToken) || []).map(parseColor).filter((c) => c && c[3] >= 0.5);
    return colors.some((c) => rgbToHsl(c[0], c[1], c[2])[2] > 0.55 && !surface(c));
  });
}

/* ---------- разбор CSS ---------- */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Делит строку по разделителю верхнего уровня (вне скобок и кавычек).
function splitTop(text, sep) {
  const parts = [];
  let depth = 0, quote = '', start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === sep && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

// Возвращает список узлов: { selector, body } или { at, children }.
function parseBlock(css) {
  const nodes = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1, quote = '';
    for (; j < css.length && depth; j++) {
      const ch = css[j];
      if (quote) { if (ch === quote && css[j - 1] !== '\\') quote = ''; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    const inner = css.slice(open + 1, j - 1);
    const cleanHead = head.replace(/^[\s;]*(@(?:import|charset)[^;]*;\s*)*/g, '').trim();
    if (cleanHead.startsWith('@')) {
      if (/^@(media|supports|container|layer)\b/.test(cleanHead)) nodes.push({ at: cleanHead, children: parseBlock(inner) });
    } else {
      nodes.push({ selector: cleanHead, body: inner });
    }
    i = j;
  }
  return nodes;
}

function scopeSelector(sel) {
  const s = sel.trim();
  if (!s || ownTheme.test(s) || /^(from|to|\d+%)$/.test(s)) return null;
  if (/^(:root|html)\b/.test(s)) return s.replace(/^(:root|html)/, scope);
  return `${scope} ${s}`;
}

function emit(nodes, indent = '') {
  let out = '';
  for (const node of nodes) {
    if (node.at) {
      const inner = emit(node.children, indent + '  ');
      if (inner) out += `${indent}${node.at} {\n${inner}${indent}}\n`;
      continue;
    }
    const decls = [];
    const keepsLightFill = hasKeptLightFill(node.body);
    for (const raw of splitTop(node.body, ';')) {
      const colon = raw.indexOf(':');
      if (colon === -1) continue;
      const prop = raw.slice(0, colon).trim().toLowerCase();
      let value = raw.slice(colon + 1).trim();
      const important = /!important\s*$/.test(value);
      value = value.replace(/\s*!important\s*$/, '');
      // Тёмный текст на яркой кнопке или плашке остаётся тёмным.
      if (keepsLightFill && roleOf(prop) === ink) continue;
      const next = convertValue(prop, value);
      if (next) decls.push(`${prop}: ${next}${important ? ' !important' : ''}`);
    }
    if (!decls.length) continue;
    const selectors = splitTop(node.selector, ',').map(scopeSelector).filter(Boolean);
    if (!selectors.length) continue;
    out += `${indent}${selectors.join(',\n' + indent)} { ${decls.join('; ')}; }\n`;
  }
  return out;
}

let result = '/* Создано scripts/build-dark-theme.mjs — не редактировать вручную. Уточнения: src/theme-dark.css */\n';
let rules = 0;
for (const file of sources) {
  const css = stripComments(await readFile(new URL(file, root), 'utf8'));
  const chunk = emit(parseBlock(css));
  rules += (chunk.match(/\{ /g) || []).length;
  result += `\n/* ${file} */\n${chunk}`;
}
await writeFile(new URL('theme-dark.generated.css', root), result);
log(`Тёмная тема: ${rules} правил из ${sources.length} файлов`);

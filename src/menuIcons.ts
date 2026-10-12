/**
 * Объёмные иконки разделов меню (согласованы по макету «Боковая панель и телефон»).
 * Каждая иконка — отдельный SVG, который подставляется как data-URI в <img>,
 * поэтому идентификаторы градиентов разных иконок не пересекаются.
 */
export type MenuIconId =
  | 'home' | 'spheres' | 'tasks' | 'quests' | 'goals' | 'plan' | 'monthly'
  | 'tree' | 'achievements' | 'shop' | 'city' | 'statistics' | 'profile';
import { habitsIconSvg, tasksIconSvg } from './menuIconsNew';
type Stop = readonly [number, string, number?];

const LG = (id: string, stops: Stop[], dir?: string): string => { const c = dir === 'h' ? 'x1="0" y1="0" x2="1" y2="0"' : dir === 'd' ? 'x1="0" y1="0" x2="1" y2="1"' : 'x1="0" y1="0" x2="0" y2="1"'; return `<linearGradient id="${id}" ${c}>` + stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] === undefined ? 1 : s[2]}"/>`).join('') + '</linearGradient>'; };
const RG = (id: string, stops: Stop[], cx?: number, cy?: number, r?: number): string => `<radialGradient id="${id}" cx="${cx || .38}" cy="${cy || .3}" r="${r || .85}">` + stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] === undefined ? 1 : s[2]}"/>`).join('') + '</radialGradient>';
const COMMON = LG('sh', [[0, '#000', 0], [.5, '#000', 0], [1, '#001030', .26]]) + LG('rim', [[0, '#fff', .85], [.4, '#fff', .12], [1, '#fff', .06]]) + LG('gl', [[0, '#fff', .55], [1, '#fff', 0]]) + '<filter id="bl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="1.7"/></filter>';
const SH = '<ellipse cx="32" cy="58.6" rx="19" ry="3.2" fill="#0A1A3C" opacity=".34" filter="url(#bl)"/>';
// тело с объёмом: заливка, затенение снизу, светлая кромка сверху
const P = (d: string, f: string): string => `<path d="${d}" fill="url(#${f})"/><path d="${d}" fill="url(#sh)"/><path d="${d}" fill="none" stroke="url(#rim)" stroke-width="1.1"/>`;
const Rr = (x: number, y: number, w: number, h: number, r: number, f: string): string => { const a = `x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"`; return `<rect ${a} fill="url(#${f})"/><rect ${a} fill="url(#sh)"/><rect ${a} fill="none" stroke="url(#rim)" stroke-width="1.1"/>`; };
const Ci = (cx: number, cy: number, r: number, f: string): string => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${f})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sh)"/><circle cx="${cx}" cy="${cy}" r="${r - .5}" fill="none" stroke="url(#rim)" stroke-width="1.1"/>`;
const SVGS: Record<MenuIconId, string> = {
  tasks: '',
  home:
    LG('w', [[0, '#FFFFFF'], [.55, '#E4E9F2'], [1, '#B9C3D6']]) + LG('r', [[0, '#E0766F'], [.5, '#B84A4B'], [1, '#7E2D36']]) + LG('d', [[0, '#7FB2F2'], [1, '#2F63C2']]) + LG('g', [[0, '#FFF3C2'], [1, '#F2B84B']]) +
    P('M12 29 L32 14 L52 29 V51 a4 4 0 0 1-4 4 H16 a4 4 0 0 1-4-4z', 'w') + Rr(26, 37, 12, 18, 3.4, 'd') +
    `<rect x="16.5" y="33" width="6.5" height="7" rx="1.6" fill="url(#g)"/><rect x="41" y="33" width="6.5" height="7" rx="1.6" fill="url(#g)"/>` +
    P('M6 31.5 L32 9 L58 31.5 L53 36.5 L32 18.6 L11 36.5z', 'r'),
  spheres:
    RG('g', [[0, '#C7F0FF'], [.45, '#4FA6F0'], [1, '#1A4DB0']]) + RG('o', [[0, '#FFD08A'], [1, '#E8872A']]) + RG('e', [[0, '#9BE8B0'], [1, '#2E9F5B']]) + RG('k', [[0, '#FFB8D6'], [1, '#D6407E']]) + LG('rg', [[0, '#F4F6FA'], [1, '#9AA6BC']], 'h') +
    '<g transform="translate(32 32) scale(.88) translate(-32 -32)"><g transform="rotate(-22 32 32)"><ellipse cx="32" cy="32" rx="27" ry="9" fill="none" stroke="url(#rg)" stroke-width="2.6"/>' + Ci(54.1, 26.8, 4.5, 'k') + '</g>' +
    Ci(32, 32, 17, 'g') + '<path d="M17.5 27 Q32 33 46.5 27 M16 37 Q32 44 48 37" stroke="#fff" stroke-opacity=".28" stroke-width="1.2" fill="none"/><path d="M22 22 a13 13 0 0 1 11-7" stroke="#fff" stroke-opacity=".7" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    '<g transform="rotate(-22 32 32)"><path d="M5 32 A27 9 0 0 0 59 32" fill="none" stroke="url(#rg)" stroke-width="2.8" stroke-linecap="round"/>' + Ci(41.2, 40.5, 4.5, 'e') + Ci(6.4, 33.2, 4.5, 'o') + '</g></g>',
  quests:
    LG('b', [[0, '#6A7283'], [1, '#2F3542']]) + LG('p', [[0, '#FFFFFF'], [1, '#E0E6F0']]) + LG('m', [[0, '#F4F6FA'], [.5, '#B8C0CE'], [1, '#7F8899']], 'h') +
    Rr(11, 9, 42, 49, 9, 'b') + Rr(16, 16, 32, 37, 5, 'p') + Rr(23, 5, 18, 11, 4.5, 'm') +
    '<path d="M21 27 l3 3 5.5-6.5 M21 38 l3 3 5.5-6.5 M21 49 l3 3 5.5-6.5" stroke="#34B36A" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="33" y="26" width="10" height="2.6" rx="1.3" fill="#C2CADA"/><rect x="33" y="37" width="10" height="2.6" rx="1.3" fill="#C2CADA"/><rect x="33" y="48" width="7" height="2.6" rx="1.3" fill="#C2CADA"/>',
  goals:
    RG('a', [[0, '#F07A78'], [1, '#B5262E']], .4, .3, .9) + LG('s', [[0, '#E9EDF3'], [1, '#7C8597']], 'd') +
    Ci(30, 34, 25, 'a') + '<circle cx="30" cy="34" r="17.5" fill="#F6F8FC"/><circle cx="30" cy="34" r="17.5" fill="url(#sh)"/><circle cx="30" cy="34" r="11" fill="#CF3037"/><circle cx="30" cy="34" r="4.6" fill="#F6F8FC"/>' +
    '<path d="M31 33 L53 10" stroke="url(#s)" stroke-width="2.4" stroke-linecap="round"/><path d="M49.5 7.5 L56.5 7.5 L56.5 14.5 L53.6 12.6 L51.4 10.4z" fill="#CF3037"/><path d="M52.5 11.5 L47 8.8 M52.5 11.5 L55.2 17" stroke="#F6F8FC" stroke-width="1.2" stroke-linecap="round"/>',
  plan:
    LG('a', [[0, '#FFFFFF'], [1, '#DDE4F0']]) + LG('h', [[0, '#EE6A66'], [1, '#B93A3F']]) + LG('m', [[0, '#F4F6FA'], [.5, '#B8C0CE'], [1, '#7F8899']], 'h') + LG('d', [[0, '#7FB2F2'], [1, '#2F63C2']]) +
    Rr(8, 12, 48, 46, 10, 'a') + P('M8 25 a10 10 0 0 1 10-13 h28 a10 10 0 0 1 10 13z', 'h') + Rr(18, 6, 4.4, 12, 2.2, 'm') + Rr(41.6, 6, 4.4, 12, 2.2, 'm') +
    '<g fill="#D3DAE8"><rect x="15.5" y="32" width="6.5" height="6.5" rx="2"/><rect x="28.7" y="32" width="6.5" height="6.5" rx="2"/><rect x="42" y="32" width="6.5" height="6.5" rx="2"/><rect x="15.5" y="43.5" width="6.5" height="6.5" rx="2"/><rect x="42" y="43.5" width="6.5" height="6.5" rx="2"/></g>' + Rr(28.2, 43, 7.6, 7.6, 2.4, 'd'),
  monthly:
    LG('a', [[0, '#FFFFFF'], [1, '#DDE4F0']]) + LG('b1', [[0, '#9CCBFF'], [1, '#4A86E0']]) + LG('b2', [[0, '#7FB2F2'], [1, '#2F63C2']]) + LG('b3', [[0, '#6C8DE8'], [1, '#3B4FB8']]) + RG('e', [[0, '#7CE0A0'], [1, '#2E9F5B']]) +
    Rr(9, 6, 42, 50, 9, 'a') + Rr(16, 35, 7.5, 12, 2.6, 'b1') + Rr(28, 26, 7.5, 21, 2.6, 'b2') + Rr(40, 16, 7.5, 31, 2.6, 'b3') +
    Ci(46, 46, 11.5, 'e') + '<path d="M40.8 46.2 l3.8 3.8 7-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  tree:
    LG('tr', [[0, '#6B4528'], [.5, '#B07A4A'], [1, '#5A3820']], 'h') + RG('c1', [[0, '#C8F5A6'], [.5, '#48B85F'], [1, '#1E7A3E']]) + RG('c2', [[0, '#B4EE94'], [.5, '#3AA553'], [1, '#17703A']]) + RG('f', [[0, '#FFF1B8'], [1, '#F0A92E']]) +
    P('M28 57 C29.5 50 29.5 44 27.5 36 L36.5 36 C34.5 44 34.5 50 36 57z', 'tr') + '<path d="M32 44 L22 35 M32 42 L43 33" stroke="#8A5A32" stroke-width="3" stroke-linecap="round" fill="none"/>' +
    Ci(19, 31, 11.5, 'c2') + Ci(45, 31, 11.5, 'c2') + Ci(32, 20, 15, 'c1') + Ci(23, 24, 8.5, 'c1') + Ci(41, 24, 8.5, 'c1') +
    '<path d="M22 14 a11 11 0 0 1 9-6" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
    Ci(27, 16, 2.6, 'f') + Ci(37, 23, 2.6, 'f') + Ci(18, 31, 2.4, 'f') + Ci(46, 33, 2.4, 'f') + Ci(32, 29, 2.2, 'f'),
  achievements:
    LG('g', [[0, '#8A5A12'], [.2, '#F2C556'], [.42, '#FFF3C2'], [.62, '#EDB93F'], [1, '#8F5E14']], 'h') + LG('g2', [[0, '#FFE9A0'], [.5, '#E7AE35'], [1, '#B27414']]) + LG('in', [[0, '#7A4E0E'], [1, '#D9A33A']]) + LG('mb', [[0, '#5B6272'], [1, '#262B36']]) + LG('st', [[0, '#FFFBE0'], [1, '#F6D27A']]) +
    '<path d="M17.5 13 C6 12 6 29 22 30.5 M46.5 13 C58 12 58 29 42 30.5" stroke="url(#g2)" stroke-width="3.6" fill="none" stroke-linecap="round"/><path d="M17.5 13 C8 12.5 8 27 22 29" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none"/>' +
    P('M28 36 H36 L35.2 45 H28.8z', 'g') + P('M16 8.5 C16 8.5 16 27 24 33.5 C27 36 29.4 37 32 37 C34.6 37 37 36 40 33.5 C48 27 48 8.5 48 8.5z', 'g') +
    '<ellipse cx="32" cy="8.5" rx="16" ry="3.6" fill="url(#in)"/><ellipse cx="32" cy="8.5" rx="16" ry="3.6" fill="none" stroke="#FFF1B8" stroke-width="1.4"/>' +
    '<polygon transform="translate(32 22.8) scale(1.45)" points="0,-7 2.1,-2.3 7.2,-1.8 3.4,1.7 4.4,6.7 0,4.2 -4.4,6.7 -3.4,1.7 -7.2,-1.8 -2.1,-2.3" fill="#8F5E14" opacity=".55"/><polygon transform="translate(32 22) scale(1.45)" points="0,-7 2.1,-2.3 7.2,-1.8 3.4,1.7 4.4,6.7 0,4.2 -4.4,6.7 -3.4,1.7 -7.2,-1.8 -2.1,-2.3" fill="url(#st)"/>' +
    '<path d="M21.5 14 C21.5 21 23.5 27 27.5 31" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    P('M32 43 c4.5 0 8 1.2 8 2.6 c0 1.4-3.5 2.6-8 2.6 s-8-1.2-8-2.6 c0-1.4 3.5-2.6 8-2.6z', 'g2') + P('M23 48 H41 L43.5 53 H20.5z', 'g') + Rr(15, 53, 34, 6, 3, 'mb'),
  shop:
    LG('a', [[0, '#6DB8FF'], [.55, '#2A7BEA'], [1, '#0B49B8']]) + LG('c', [[0, '#E8EDF7'], [1, '#8E9CB8']]) +
    '<path d="M22.5 26 V19 a9.5 9.5 0 0 1 19 0 V26" stroke="url(#c)" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
    P('M12 22 H52 L49.4 52.4 a4.5 4.5 0 0 1-4.5 4.1 H19.1 a4.5 4.5 0 0 1-4.5-4.1z', 'a') +
    '<path d="M13 28 H51" stroke="#fff" stroke-opacity=".25" stroke-width="1.1"/><circle cx="22.5" cy="26" r="2.2" fill="#E9EEF8"/><circle cx="41.5" cy="26" r="2.2" fill="#E9EEF8"/>',
  city:
    LG('m1', [[0, '#CDEFB4'], [1, '#7CC46A']]) + LG('m2', [[0, '#FBF8EE'], [1, '#DAD4C2']]) + LG('m3', [[0, '#BFE3FF'], [1, '#5BA8E8']]) + RG('pin', [[0, '#FF8A80'], [.55, '#E23A3F'], [1, '#A01C28']]) +
    P('M7 21 L22 15.5 V51 L7 56.5z', 'm1') + P('M22 15.5 L42 21.5 V57 L22 51z', 'm2') + P('M42 21.5 L57 16 V51.5 L42 57z', 'm3') +
    '<path d="M25 44 L39 48.5 M25 36 L39 40.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M10 35 L19 31.5 M10 44 L19 40.5" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/><path d="M45 36 Q50 31 54 33" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<ellipse cx="32" cy="43" rx="5" ry="1.8" fill="#0A1A3C" opacity=".3" filter="url(#bl)"/>' +
    P('M32 44 C32 44 21.5 33.5 21.5 25 a10.5 10.5 0 0 1 21 0 C42.5 33.5 32 44 32 44z', 'pin') + '<circle cx="32" cy="25" r="4.2" fill="#fff"/><path d="M25.5 21 a8 8 0 0 1 7-4.5" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  statistics:
    LG('a', [[0, '#8FE6EE'], [1, '#1E9DB8']]) + LG('b', [[0, '#8FC4FF'], [1, '#2F6FD8']]) + LG('c', [[0, '#B6A2F5'], [1, '#5A3FC4']]) +
    Rr(7, 35, 14, 21, 5, 'a') + Rr(25, 23, 14, 33, 5, 'b') + Rr(43, 11, 14, 45, 5, 'c') +
    '<path d="M8 21 L22 12 L33 17 L52 5" stroke="#fff" stroke-opacity=".95" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="22" cy="12" r="2.6" fill="#fff"/><circle cx="33" cy="17" r="2.6" fill="#fff"/><circle cx="52" cy="5" r="2.6" fill="#fff"/>',
  profile:
    LG('k', [[0, '#FFFFFF'], [1, '#DCE3F0']]) + LG('t', [[0, '#7FB6FF'], [1, '#2F63C2']]) + RG('av', [[0, '#8EC5FF'], [.6, '#3B7CE0'], [1, '#2450A8']]) +
    Rr(7, 13, 50, 38, 9, 'k') + Ci(21.5, 34, 9.5, 'av') +
    '<circle cx="21.5" cy="31" r="3.4" fill="#fff"/><path d="M14.6 40.6 a7 6 0 0 1 13.8 0 a9.5 9.5 0 0 1-13.8 0z" fill="#fff"/>' +
    '<rect x="35" y="28" width="16" height="3.2" rx="1.6" fill="#B9C3D8"/><rect x="35" y="35" width="12" height="3.2" rx="1.6" fill="#D0D7E6"/><rect x="35" y="42" width="14" height="3.2" rx="1.6" fill="#D0D7E6"/>' +
    '<rect x="26" y="17.5" width="12" height="3.6" rx="1.8" fill="#C5CEE0"/>'
};

const cache = new Map<MenuIconId, string>();

/** Адрес картинки иконки раздела; строится один раз и кешируется. */
export function menuIconSrc(id: MenuIconId): string {
  let src = cache.get(id);
  if (!src) {
    const ready = id === 'quests' ? habitsIconSvg : id === 'tasks' ? tasksIconSvg : '';
    src = ready
      ? `data:image/svg+xml;utf8,${encodeURIComponent(ready)}`
      : `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${COMMON}</defs>${SH}${SVGS[id]}</svg>`)}`;
    cache.set(id, src);
  }
  return src;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* PLAY YOUR LIFE 2.0 — локальное хранилище «Нашей жизни» (демо-режим).
 * Повторяет нужную часть API firebase/firestore и хранит данные в localStorage этого браузера.
 * Включается, когда облако отвечает «нет доступа» (правила Firestore ещё не опубликованы). */
type Data = Record<string, any>;
const KEY = 'play-your-life-our-demo-v1';
const SENT = '__pylSentinel';
const store = new Map<string, Data>();
try { const raw = localStorage.getItem(KEY); if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Data>)) store.set(k, v); } catch { /* пусто */ }
const clone = (v: any) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const listeners = new Set<() => void>();
let auto = 0;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(store))); } catch { /* переполнено — работаем в памяти */ } };
const fire = () => { save(); queueMicrotask(() => listeners.forEach((l) => l())); };

export const localDb = { path: '', local: true } as const;
export const serverTimestamp = () => ({ [SENT]: 'ts' });
export const increment = (n: number) => ({ [SENT]: 'inc', n });
export const arrayUnion = (...v: any[]) => ({ [SENT]: 'union', v });
export const where = (f: string, op: string, v: any) => ({ t: 'where', f, op, v });
export const orderBy = (f: string, dir = 'asc') => ({ t: 'order', f, dir });
export const limit = (n: number) => ({ t: 'limit', n });
const join = (a: any, segs: string[]) => [a?.path, ...segs].filter(Boolean).join('/');
export function collection(base: any, ...segs: string[]) { return { path: join(base, segs), kind: 'col' }; }
export function doc(base: any, ...segs: string[]) {
  const path = segs.length ? join(base, segs) : `${base.path}/l${Date.now().toString(36)}${(++auto).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { path, id: path.split('/').pop()!, kind: 'doc' };
}
export const query = (c: any, ...cs: any[]) => ({ path: c.path, cs });
const get = (o: any, p: string) => p.split('.').reduce((x, k) => x?.[k], o);
const isSent = (v: any) => !!v && typeof v === 'object' && SENT in v;
function resolve(v: any, old: any): any {
  if (!isSent(v)) return v;
  if (v[SENT] === 'ts') return Date.now();
  if (v[SENT] === 'inc') return (typeof old === 'number' ? old : 0) + v.n;
  const prev = Array.isArray(old) ? old : [];
  return [...prev, ...v.v.filter((x: any) => !prev.includes(x))];
}
function apply(target: Data, data: Data, dotted: boolean) {
  for (const [k, v] of Object.entries(data)) {
    const keys = dotted ? k.split('.') : [k];
    let o = target;
    for (const kk of keys.slice(0, -1)) o = o[kk] = typeof o[kk] === 'object' && o[kk] ? { ...o[kk] } : {};
    const last = keys[keys.length - 1];
    o[last] = isSent(v) ? resolve(v, o[last]) : clone(v);
  }
}
function setIn(target: Data, data: Data) {
  for (const [k, v] of Object.entries(data)) {
    if (isSent(v)) target[k] = resolve(v, target[k]);
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) setIn(target[k], v);
    else target[k] = clone(v);
  }
}
export async function setDoc(ref: any, data: Data, opt?: { merge?: boolean }) {
  const cur = opt?.merge ? clone(store.get(ref.path) ?? {}) : {};
  setIn(cur, data);
  store.set(ref.path, cur); fire();
}
export async function updateDoc(ref: any, data: Data) {
  if (!store.has(ref.path)) throw Object.assign(new Error('Запись не найдена'), { code: 'not-found' });
  const cur = clone(store.get(ref.path)!); apply(cur, data, true); store.set(ref.path, cur); fire();
}
export async function deleteDoc(ref: any) { store.delete(ref.path); fire(); }
const snapDoc = (path: string) => ({ id: path.split('/').pop(), exists: () => store.has(path), data: () => clone(store.get(path)), metadata: { hasPendingWrites: false } });
export async function getDoc(ref: any) { return snapDoc(ref.path); }
export async function runTransaction(_db: any, fn: any) {
  return fn({
    get: async (r: any) => snapDoc(r.path),
    set: (r: any, d: Data) => { const cur = {}; setIn(cur, d); store.set(r.path, cur); fire(); },
    update: (r: any, d: Data) => { const cur = clone(store.get(r.path) ?? {}); apply(cur, d, true); store.set(r.path, cur); fire(); },
  });
}
function run(q: any) {
  const depth = q.path.split('/').length + 1;
  let rows = [...store.keys()].filter((p) => p.startsWith(`${q.path}/`) && p.split('/').length === depth);
  for (const c of q.cs ?? []) if (c.t === 'where') rows = rows.filter((p) => {
    const v = get(store.get(p), c.f);
    if (c.op === 'array-contains') return Array.isArray(v) && v.includes(c.v);
    if (c.op === 'in') return Array.isArray(c.v) && c.v.includes(v);
    if (c.op === '>=') return v >= c.v;
    if (c.op === '<=') return v <= c.v;
    if (c.op === '>') return v > c.v;
    if (c.op === '<') return v < c.v;
    if (c.op === '!=') return v !== c.v;
    return v === c.v;
  });
  const orders = (q.cs ?? []).filter((c: any) => c.t === 'order');
  rows.sort((a, b) => {
    for (const c of orders) {
      const x = get(store.get(a), c.f), y = get(store.get(b), c.f);
      const d = (x > y ? 1 : x < y ? -1 : 0) * (c.dir === 'desc' ? -1 : 1);
      if (d) return d;
    }
    return 0;
  });
  const lim = (q.cs ?? []).find((c: any) => c.t === 'limit'); if (lim) rows = rows.slice(0, lim.n);
  return { docs: rows.map(snapDoc) };
}
export function onSnapshot(q: any, a: any, b?: any) {
  const next = typeof a === 'function' ? a : b;
  const l = () => next(run(q)); listeners.add(l); queueMicrotask(l);
  return () => { listeners.delete(l); };
}

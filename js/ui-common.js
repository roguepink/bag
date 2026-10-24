// 画面の共通部品: 保存・ほかの係のモジュールの読み込み・小さな絵・ことば
// ほかの係のファイルが無くても壊れないように、すべて動的 import + try/catch。

// ---------- 保存(localStorage) ----------
const KEY = 'bag-katagami.v1';
const DEFAULTS = { lastBag: null, size: 'M', fabric: null, colorway: null, paper: 'A4', hintShown: false, step: {} };
let state = { ...DEFAULTS };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
} catch (e) { /* 保存が使えなくても動く */ }

export const store = {
  get(k) { return state[k]; },
  set(k, v) {
    state[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* なにもしない */ }
  },
};

// ---------- ほかの係のモジュール ----------
const cache = {};
async function load(name, path) {
  if (!(name in cache)) {
    cache[name] = import(path).catch((err) => {
      console.warn(`[ui] ${path} を読めませんでした`, err);
      return null;
    });
  }
  return cache[name];
}
export const loadBags = () => load('bags', './bags/index.js');
export const loadPrint = () => load('print', './print.js');
export const loadFabric = () => load('fabric', './fabric.js');
export const loadViewer = () => load('viewer', './viewer3d.js');

export async function getCatalog() {
  const m = await loadBags();
  const groups = (m && Array.isArray(m.GROUPS)) ? m.GROUPS : [];
  const bags = (m && Array.isArray(m.BAGS)) ? m.BAGS : [];
  return { groups, bags };
}

export function safe(fn, fallback) {
  try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { console.warn('[ui]', e); return fallback; }
}

// ---------- サイズ ----------
export const SIZE_KEYS = ['S', 'M', 'L'];
export const SIZE_NAME = { S: '小', M: '中', L: '大' };
export function sizeKeysOf(bag) {
  const s = (bag && bag.sizes) || {};
  const keys = SIZE_KEYS.filter((k) => s[k]);
  return keys.length ? keys : SIZE_KEYS;
}
export function pickSize(bag, want) {
  const keys = sizeKeysOf(bag);
  return keys.includes(want) ? want : (keys.includes('M') ? 'M' : keys[0]);
}
/** bag.shape/pieces/steps/extras に渡す p */
export function paramsOf(bag, sizeKey) {
  const s = (bag.sizes && bag.sizes[sizeKey]) || {};
  return { ...s, size: sizeKey, sizeKey };
}
const cm = (mm) => {
  const v = Math.round((Number(mm) || 0) / 10 * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
export function dimText(bag, sizeKey) {
  const s = (bag.sizes && bag.sizes[sizeKey]) || {};
  const parts = [];
  if (s.w) parts.push(`よこ${cm(s.w)}cm`);
  if (s.h) parts.push(`たて${cm(s.h)}cm`);
  if (s.d) parts.push(`マチ${cm(s.d)}cm`);
  return parts.join(' × ');
}
export { cm };

export const LEVEL = {
  1: { name: 'かんたん', dots: 1 },
  2: { name: 'ふつう', dots: 2 },
  3: { name: 'がんばる', dots: 3 },
};
export function levelBadge(level) {
  const L = LEVEL[level] || LEVEL[2];
  const dots = '●'.repeat(L.dots) + `<i>${'●'.repeat(3 - L.dots)}</i>`;
  return `<span class="badge"><span class="dots" aria-hidden="true">${dots}</span>${L.name}</span>`;
}
export function trendBadge(trend) {
  return trend ? `<span class="badge trend"><span aria-hidden="true">★</span>いま人気</span>` : '';
}

// ---------- 見た目(柄・色) ----------
export async function currentLook() {
  const fab = await loadFabric();
  const F = (fab && fab.FABRICS) || [];
  const C = (fab && fab.COLORWAYS) || [];
  let fabric = store.get('fabric');
  let colorway = store.get('colorway');
  if (!F.find((f) => f.id === fabric)) fabric = F[0] ? F[0].id : null;
  if (!C.find((c) => c.id === colorway)) colorway = C[0] ? C[0].id : null;
  return lookOf(fabric, colorway, C);
}
export function lookOf(fabric, colorway, COLORWAYS = []) {
  const cw = COLORWAYS.find((c) => c.id === colorway);
  const cols = (cw && cw.colors) || [];
  return {
    fabric, colorway,
    lining: cols[1] || '#efe7d8',
    strapColor: cols[2] || cols[0] || '#5b4636',
  };
}

// ---------- ことば ----------
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function toast(msg, ms = 2600) {
  const el = h(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- 小さな絵(線画・currentColor) ----------
const HANDLE = '<path d="M34 34V26a14 14 0 0 1 28 0v8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
const ICONS = {
  tote: `${HANDLE}<path d="M18 34h60l-5 46H23z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M30 46h36" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 4" opacity=".6"/>`,
  shoulder: `<path d="M24 46C24 14 72 14 72 46" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><rect x="16" y="44" width="64" height="38" rx="10" fill="none" stroke="currentColor" stroke-width="4"/><path d="M16 56h64" stroke="currentColor" stroke-width="3"/><circle cx="48" cy="62" r="3.5" fill="currentColor"/>`,
  pouch: `<path d="M14 36h68v34a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M14 36h68" stroke="currentColor" stroke-width="4"/><path d="M20 42h56" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/><path d="M66 36v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="62" y="46" width="8" height="10" rx="2" fill="currentColor"/>`,
  backpack: `<path d="M36 22a12 12 0 0 1 24 0" fill="none" stroke="currentColor" stroke-width="4"/><rect x="22" y="22" width="52" height="62" rx="16" fill="none" stroke="currentColor" stroke-width="4"/><rect x="32" y="54" width="32" height="22" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 40h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
  drawstring: `<path d="M26 32c6 4 38 4 44 0l4 40a12 12 0 0 1-12 12H34a12 12 0 0 1-12-12z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M28 40c10 3 30 3 40 0" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M40 38l-6 14M56 38l6 14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="55" r="3" fill="currentColor"/><circle cx="62" cy="55" r="3" fill="currentColor"/>`,
  azuma: `<path d="M18 30l30 26 30-26-8 44a10 10 0 0 1-10 8H36a10 10 0 0 1-10-8z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M18 30c-2-10 8-16 16-12M78 30c2-10-8-16-16-12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  clutch: `<rect x="12" y="32" width="72" height="44" rx="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M12 38l36 22 36-22" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="48" cy="58" r="4" fill="currentColor"/>`,
  round: `<circle cx="48" cy="58" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M30 40C30 14 66 14 66 40" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M26 58h44" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 4" opacity=".6"/>`,
  halfmoon: `<path d="M14 44h68a34 34 0 0 1-68 0z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M22 44C22 18 74 18 74 44" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  knot: `<path d="M22 40h52l-4 38a8 8 0 0 1-8 6H34a8 8 0 0 1-8-6z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M22 40V20c0-4 10-4 10 0v20M64 40V24c0-4 10-4 10 0v16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
  boston: `<path d="M34 34V28a14 10 0 0 1 28 0v6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M14 52c0-10 8-18 18-18h32c10 0 18 8 18 18v22a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M22 46h52" stroke="currentColor" stroke-width="3"/>`,
  bag: `${HANDLE}<path d="M16 34h64l-4 48H20z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>`,
};
const FAMILY_ICON = {
  flat: 'tote', boxed: 'tote', gusset: 'tote', trapezoid: 'tote', cylinder: 'drawstring',
  halfmoon: 'halfmoon', backpack: 'backpack', round: 'round', envelope: 'clutch',
  gathered: 'drawstring', knot: 'knot', azuma: 'azuma',
};
function iconKeyFor(id = '') {
  const s = String(id).toLowerCase();
  const map = [
    ['tote', 'tote'], ['eco', 'tote'], ['market', 'tote'], ['shoulder', 'shoulder'], ['sacoche', 'shoulder'], ['cross', 'shoulder'],
    ['pouch', 'pouch'], ['zip', 'pouch'], ['back', 'backpack'], ['ruck', 'backpack'], ['kinchaku', 'drawstring'],
    ['draw', 'drawstring'], ['purse', 'drawstring'], ['azuma', 'azuma'], ['furoshiki', 'azuma'], ['clutch', 'clutch'], ['envelope', 'clutch'],
    ['round', 'round'], ['moon', 'halfmoon'], ['knot', 'knot'], ['boston', 'boston'], ['travel', 'boston'],
  ];
  for (const [k, v] of map) if (s.includes(k)) return v;
  return 'bag';
}
export function iconSVG(key, label = '') {
  const body = ICONS[key] || ICONS.bag;
  return `<svg viewBox="0 0 96 96" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
export function groupIcon(group) {
  const ic = group && group.icon;
  if (typeof ic === 'string' && ic.trim().startsWith('<svg')) return ic;
  if (typeof ic === 'string' && ic.trim() && ic.length <= 4) return `<span aria-hidden="true">${esc(ic)}</span>`;
  return iconSVG(iconKeyFor(group && group.id), group && group.name);
}
export function bagIcon(bag) {
  let fam = null;
  try { fam = bag.shape(paramsOf(bag, pickSize(bag, 'M'))).family; } catch (e) { /* なし */ }
  const key = FAMILY_ICON[fam] || iconKeyFor(bag.group || bag.id);
  return iconSVG(key, bag.name);
}

export const FINGER_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 26V11a3 3 0 0 1 6 0v12l9 2a4 4 0 0 1 3 4.5L36.5 40a4 4 0 0 1-4 3.5H24a4 4 0 0 1-3.2-1.6L13 32a3 3 0 0 1 4.6-3.8z" fill="#fff"/><path d="M6 10h8M6 10l3-3M6 10l3 3M42 10h-8M42 10l-3-3M42 10l-3 3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>`;

// ---------- 一覧のカード用の絵(3D の snapshot) ----------
const shots = new Map(); // key -> dataURL
let shooter = null;      // { viewer, el }
let queue = Promise.resolve();
export function snapshotKey(bag, look) { return `${bag.id}|${look.fabric}|${look.colorway}`; }
export function cachedSnapshot(bag, look) { return shots.get(snapshotKey(bag, look)) || null; }
/** 3D係の snapshot で絵を作る(1枚ずつ順番に)。作れないときは null */
export function snapshotOf(bag, look, px = 320) {
  const key = snapshotKey(bag, look);
  if (shots.has(key)) return Promise.resolve(shots.get(key));
  const job = queue.then(async () => {
    if (shots.has(key)) return shots.get(key);
    const mod = await loadViewer();
    if (!mod || typeof mod.createViewer !== 'function') return null;
    if (!shooter) {
      const el = document.createElement('div');
      el.className = 'offstage';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
      try { shooter = { el, viewer: mod.createViewer(el) }; } catch (e) { console.warn('[ui] 3D を作れません', e); el.remove(); return null; }
      try { shooter.viewer.setAutoRotate && shooter.viewer.setAutoRotate(false); } catch (e) { /* なし */ }
    }
    try {
      const shape = bag.shape(paramsOf(bag, pickSize(bag, 'M')));
      await shooter.viewer.show(shape, look);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const url = await shooter.viewer.snapshot(px);
      if (typeof url === 'string' && url.startsWith('data:')) { shots.set(key, url); return url; }
    } catch (e) { console.warn('[ui] snapshot できませんでした', bag.id, e); }
    return null;
  });
  queue = job.catch(() => null);
  return job;
}

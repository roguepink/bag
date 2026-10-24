// print.js — 型紙を並べる・全体図・印刷ページ・布の量(型紙係)
// 単位は mm。SVG の viewBox も mm なので、印刷すると原寸になる。
import {
  offset, bbox, foldEdges, mirror, nearestEdge, edgeNormal, polyHitsRect, centroid, cm,
} from './geom.js';

export const FABRIC_NAME = { outer: '表布', lining: '裏布', interfacing: '接着芯', accent: '配色布' };
const FABRIC_ORDER = ['outer', 'lining', 'accent', 'interfacing'];
const FABRIC_TINT = { outer: '#f1e4d3', lining: '#dde8f2', interfacing: '#ececec', accent: '#f4dde3' };
export const PAPERS = { A4: [210, 297], A3: [297, 420] };
export const MARGIN = 10;   // 紙の余白
export const GLUE = 10;     // のりしろ
const GAP = 6;              // パーツどうしのすきま
const FONT = "'Hiragino Maru Gothic ProN','Hiragino Sans','BIZ UDPGothic','Yu Gothic','Noto Sans JP',sans-serif";

let uid = 0;

// ---------- パーツの下ごしらえ ----------
function sizeOf(bag, sizeKey) {
  const s = (bag.sizes && (bag.sizes[sizeKey] || bag.sizes.M || Object.values(bag.sizes)[0])) || {};
  return { ...s, key: sizeKey };
}

export function getPieces(bag, sizeKey) {
  return (bag.pieces(sizeOf(bag, sizeKey)) || []).filter(Boolean);
}

// 布ごとの枚数 [{fabric, cut}]
export function cutsOf(piece) {
  return [{ fabric: piece.fabric || 'outer', cut: piece.cut ?? 1 }, ...(piece.more || [])];
}

export function seamArray(piece) {
  const n = piece.outline.length;
  const flags = foldEdges(piece.outline, piece.fold);
  const s = [];
  for (let i = 0; i < n; i++) {
    const v = Array.isArray(piece.seam) ? (piece.seam[i] ?? piece.seam[piece.seam.length - 1] ?? 0) : (piece.seam ?? 0);
    s.push(flags[i] ? 0 : v);
  }
  return s;
}

// 切る線(縫い代つき)。fold の辺は 0。
export function cutOutline(piece) {
  return piece.measureOnly ? piece.outline.slice() : offset(piece.outline, seamArray(piece));
}

// わ の辺の並び(点の列)
function foldRuns(outline, flags) {
  const n = outline.length, runs = [];
  if (!flags.some(Boolean)) return runs;
  let start = flags.findIndex((f, i) => f && !flags[(i - 1 + n) % n]);
  if (start < 0) start = 0;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (flags[i] && !flags[(i - 1 + n) % n]) runs.push([outline[i]]);
    if (flags[i]) runs[runs.length - 1].push(outline[(i + 1) % n]);
  }
  return runs;
}

function prepare(piece) {
  const outline = piece.outline.map((p) => [p[0], p[1]]);
  const seams = seamArray(piece);
  const flags = foldEdges(outline, piece.fold);
  return { piece, outline, seams, cut: cutOutline(piece), folds: foldRuns(outline, flags) };
}

// 回して(0 / 90)、切る線の左上を (0,0) にする
function place(prep, rot) {
  const T = rot === 90 ? ([x, y]) => [-y, x] : ([x, y]) => [x, y];
  const cut0 = prep.cut.map(T);
  const b = bbox(cut0);
  const M = (p) => { const q = T(p); return [q[0] - b.minX, q[1] - b.minY]; };
  const mapPts = (pts) => pts.map(M);
  const marks = (prep.piece.marks || []).map((m) => ({ ...m, at: m.at ? M(m.at) : undefined, pts: m.pts ? mapPts(m.pts) : undefined }));
  return {
    piece: prep.piece, rot, seams: prep.seams,
    outline: mapPts(prep.outline), cut: mapPts(prep.cut), folds: prep.folds.map(mapPts),
    grain: prep.piece.grain ? mapPts(prep.piece.grain) : null, marks, w: b.w, h: b.h,
    labelAt: prep.piece.labelAt ? M(prep.piece.labelAt) : null,
  };
}

// できあがりの大きさ(わ はひらいた形)
export function finishedSize(piece) {
  const full = piece.fold ? mirror(piece.outline, piece.fold) : piece.outline;
  const b = bbox(full);
  return [b.w, b.h];
}

function uniformSeam(pieces) {
  const vals = new Set();
  for (const pc of pieces) if (!pc.measureOnly) for (const s of seamArray(pc)) if (s > 0) vals.add(s);
  return vals.size === 1 ? [...vals][0] : vals.size === 0 ? 0 : null;
}

function countText(piece) {
  const unit = piece.measureOnly ? '本' : '枚';
  return cutsOf(piece).map((c) => `${FABRIC_NAME[c.fabric] || c.fabric} ${c.cut}${piece.unit || unit}`).join('・') + (piece.fold ? '(わ)' : '');
}

// ---------- ならべる ----------
// rects: [{key, w, h, rot}] → {placed:[{key,x,y,w,h,rotate}], H}
function pack(rects, W, opt = {}) {
  const gap = opt.gap ?? GAP;
  const tile = opt.tile || null;
  const obst = (opt.reserved || []).map((r) => ({ ...r }));
  const placed = [];
  let maxB = obst.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  const all = () => obst.concat(placed);
  const e = 1e-6;
  const collide = (x, y, w, h) => all().some((q) => x < q.x + q.w + gap - e && x + w + gap > q.x + e && y < q.y + q.h + gap - e && y + h + gap > q.y + e);
  const fitsTile = (x, y, w, h) => {
    const okAxis = (a, len, step, size) => {
      const c0 = Math.floor(a / step);
      for (const c of [c0, c0 - 1]) if (c >= 0 && c * step <= a + e && a + len <= c * step + size + e) return true;
      return false;
    };
    return okAxis(x, w, tile.sx, tile.tw) && okAxis(y, h, tile.sy, tile.th);
  };
  for (const r of rects) {
    let best = null;
    const ors = [[r.w, r.h, 0]];
    if (r.rot !== false && Math.abs(r.w - r.h) > 0.5) ors.push([r.h, r.w, 90]);
    for (const [w, h, rot] of ors) {
      if (w > W + e) continue;
      const small = tile && w <= tile.tw && h <= tile.th;
      const xs = new Set([0]), ys = new Set([0]);
      for (const q of all()) { xs.add(q.x + q.w + gap); ys.add(q.y + q.h + gap); xs.add(q.x); ys.add(q.y); }
      if (tile) {
        for (let k = 0; k * tile.sx < W; k++) xs.add(k * tile.sx);
        const yMax = maxB + h + tile.sy * 2;
        for (let k = 0; k * tile.sy < yMax; k++) ys.add(k * tile.sy);
      }
      const yList = [...ys].sort((a, b) => a - b);
      const xList = [...xs].sort((a, b) => a - b);
      for (const y of yList) {
        if (best && Math.max(maxB, y + h) * 1000 + y > best.score) break;
        for (const x of xList) {
          if (x + w > W + e) continue;
          if (collide(x, y, w, h)) continue;
          if (small && !fitsTile(x, y, w, h)) continue;
          const score = Math.max(maxB, y + h) * 1000 + y + x * 0.001;
          if (!best || score < best.score) best = { x, y, w, h, rot, score };
          break; // この y ではいちばん左がいちばん良い
        }
      }
    }
    if (!best) {
      // 幅に入らない(回しても)→ 下にそのまま置く
      best = { x: 0, y: maxB + (placed.length ? gap : 0), w: r.w, h: r.h, rot: 0 };
    }
    placed.push({ key: r.key, x: best.x, y: best.y, w: best.w, h: best.h, rotate: best.rot });
    maxB = Math.max(maxB, best.y + best.h);
  }
  return { placed, H: maxB };
}

const ORDERS = [
  (a, b) => b.w * b.h - a.w * a.h,
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h),
  (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h),
];

function preparedFor(bag, sizeKey) {
  return getPieces(bag, sizeKey).filter((pc) => !pc.measureOnly && pc.outline && pc.outline.length >= 3).map(prepare);
}

function itemsFrom(preps, res) {
  return res.placed.map((pl) => {
    const prep = preps[pl.key];
    const g = place(prep, pl.rotate);
    return { piece: prep.piece, x: pl.x, y: pl.y, rotate: pl.rotate, w: g.w, h: g.h, geom: g };
  });
}

// 全パーツを1つずつ、原寸の大きな紙に並べる(画面の全体図・布の量の目安)
// opts.tile を渡すと、紙のページに合わせて並べる(小さいパーツはページをまたがない)
export function layoutPieces(bag, sizeKey, opts = {}) {
  const preps = preparedFor(bag, sizeKey);
  const rects = preps.map((p, i) => { const b = bbox(p.cut); return { key: i, w: b.w, h: b.h }; });
  if (!rects.length) return { sheetW: 0, sheetH: 0, items: [] };
  if (opts.width) {
    let best = null;
    for (const ord of ORDERS) {
      const res = pack(rects.slice().sort(ord), opts.width, { tile: opts.tile, reserved: opts.reserved });
      const score = opts.score ? opts.score(itemsFrom(preps, res), res) : res.H;
      if (!best || score < best.score) best = { res, score };
    }
    return { sheetW: opts.width, sheetH: best.res.H, items: itemsFrom(preps, best.res) };
  }
  // 幅を何通りか試して、むだが少なく、横長すぎない並べ方
  const minW = Math.max(...rects.map((r) => Math.min(r.w, r.h)));
  const sumA = rects.reduce((s, r) => s + r.w * r.h, 0);
  const cands = new Set([Math.max(...rects.map((r) => Math.max(r.w, r.h)))]);
  for (let f = 0.8; f <= 2.2; f += 0.1) cands.add(Math.max(minW, Math.sqrt(sumA) * f));
  let best = null;
  for (const W of cands) {
    for (const ord of ORDERS) {
      const res = pack(rects.slice().sort(ord), W);
      const usedW = Math.max(...res.placed.map((p) => p.x + p.w));
      const area = usedW * res.H;
      const aspect = usedW / res.H;
      const score = area * (1 + 0.35 * Math.abs(Math.log(aspect / 1.4)));
      if (!best || score < best.score) best = { res, score, usedW };
    }
  }
  return { sheetW: best.usedW, sheetH: best.res.H, items: itemsFrom(preps, best.res) };
}

// ---------- SVG の部品 ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => (Math.round(v * 100) / 100).toString();
const pathD = (pts, close = true, dx = 0, dy = 0) => pts.length ? 'M' + pts.map((p) => `${f1(p[0] + dx)},${f1(p[1] + dy)}`).join('L') + (close ? 'Z' : '') : '';

// 文字の幅の目安(全角 1、半角 0.6)
function textW(s) { let w = 0; for (const ch of String(s)) w += /[\x20-\x7e]/.test(ch) ? 0.6 : 1; return w; }

function upright(dx, dy) {
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (a > 90) a -= 180;
  if (a < -90) a += 180;
  return a;
}

function text(x, y, s, size, o = {}) {
  const attrs = [`x="${f1(x)}"`, `y="${f1(y)}"`, `font-size="${f1(size)}"`];
  if (o.anchor) attrs.push(`text-anchor="${o.anchor}"`);
  if (o.weight) attrs.push(`font-weight="${o.weight}"`);
  attrs.push(`fill="${o.fill || '#222'}"`);
  if (o.rot) attrs.push(`transform="rotate(${f1(o.rot)} ${f1(x)} ${f1(y)})"`);
  if (o.baseline) attrs.push(`dominant-baseline="${o.baseline}"`);
  if (o.halo) attrs.push(`stroke="#fff" stroke-width="${f1(size * 0.22)}" paint-order="stroke" stroke-linejoin="round"`);
  return `<text ${attrs.join(' ')}>${esc(s)}</text>`;
}

// 切る線(わ の辺はのぞく)を、線の列にする
function cutSegments(g) {
  const pts = g.cut, n = pts.length;
  const onFold = (p) => g.folds.some((run) => run.some((q, i) => {
    const r = run[i + 1]; if (!r) return false;
    const dx = r[0] - q[0], dy = r[1] - q[1], L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / L2));
    return Math.hypot(p[0] - (q[0] + dx * t), p[1] - (q[1] + dy * t)) < 0.05;
  }));
  if (!g.folds.length) return [{ pts, closed: true }];
  const skip = [];
  for (let i = 0; i < n; i++) skip.push(onFold(pts[i]) && onFold(pts[(i + 1) % n]));
  const start = skip.findIndex((s) => s);
  if (start < 0) return [{ pts, closed: true }];
  const segs = [];
  let cur = null;
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if (skip[i]) { if (cur) { segs.push({ pts: cur, closed: false }); cur = null; } continue; }
    if (!cur) cur = [pts[i]];
    cur.push(pts[(i + 1) % n]);
  }
  if (cur) segs.push({ pts: cur, closed: false });
  return segs;
}

// パーツ1つを描く。g = place() の結果。(x,y) は紙の上の位置。
// o: { mode:'print'|'overview', u: 線と文字の基準(mm), fill, num }
function pieceSVG(g, x, y, o) {
  const u = o.u || 1;
  const pc = g.piece;
  const out = [`<g data-piece="${esc(pc.id || '')}">`];
  const tr = (pts) => pts.map((p) => [p[0] + x, p[1] + y]);
  const cutP = tr(g.cut), outP = tr(g.outline);
  if (o.mode === 'overview') {
    out.push(`<path d="${pathD(cutP)}" fill="${FABRIC_TINT[pc.fabric] || '#eee'}" stroke="none"/>`);
    out.push(`<path d="${pathD(outP)}" fill="${o.fill || '#fff'}" stroke="none"/>`);
  }
  // 切る線(太い実線)
  for (const s of cutSegments(g)) out.push(`<path d="${pathD(tr(s.pts), s.closed)}" fill="none" stroke="#1f1f1f" stroke-width="${f1(0.7 * u)}" stroke-linejoin="round" stroke-linecap="round"/>`);
  // できあがり線(細い実線)
  out.push(`<path d="${pathD(outP)}" fill="none" stroke="#6b6b6b" stroke-width="${f1(0.3 * u)}" stroke-linejoin="round"/>`);
  // わ
  for (const run of g.folds) {
    const R = tr(run);
    out.push(`<path d="${pathD(R, false)}" fill="none" stroke="#a23b2a" stroke-width="${f1(0.9 * u)}" stroke-dasharray="${f1(6 * u)} ${f1(2 * u)} ${f1(1.2 * u)} ${f1(2 * u)}"/>`);
    const a = R[0], b = R[R.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 20 * u) continue;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    // 内側へ少し入れる
    const ne = nearestEdge(outP, [mx, my]);
    const nn = edgeNormal(outP, ne.index);
    const fs = Math.min(6 * u, L / 8);
    const tx = mx - nn[0] * fs * 1.3, ty = my - nn[1] * fs * 1.3;
    out.push(text(tx, ty, o.mode === 'overview' ? 'わ' : 'わ(ここは布を折った線。切らない)', o.mode === 'overview' ? fs * 1.4 : fs * 0.62, { anchor: 'middle', baseline: 'central', rot: upright(b[0] - a[0], b[1] - a[1]), fill: '#a23b2a', weight: 'bold', halo: true }));
  }
  // 布目
  if (g.grain) {
    const [p, q] = tr(g.grain);
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, hs = 3.5 * u;
    const head = (P, sx) => `M${f1(P[0] - sx * ux * hs - uy * hs * 0.5)},${f1(P[1] - sx * uy * hs + ux * hs * 0.5)}L${f1(P[0])},${f1(P[1])}L${f1(P[0] - sx * ux * hs + uy * hs * 0.5)},${f1(P[1] - sx * uy * hs - ux * hs * 0.5)}`;
    out.push(`<path d="M${f1(p[0])},${f1(p[1])}L${f1(q[0])},${f1(q[1])}${head(q, 1)}${head(p, -1)}" fill="none" stroke="#2c5d8a" stroke-width="${f1(0.5 * u)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (o.mode !== 'overview') out.push(text((p[0] + q[0]) / 2 - uy * 3 * u, (p[1] + q[1]) / 2 + ux * 3 * u, '布目(この向きを布のたて糸に)', 3 * u, { anchor: 'middle', baseline: 'central', rot: upright(dx, dy), fill: '#2c5d8a', halo: true }));
  }
  // 印
  for (const m of g.marks) {
    if (m.type === 'notch' && m.at) {
      const P = [m.at[0] + x, m.at[1] + y];
      const ne = nearestEdge(outP, P);
      const nn = edgeNormal(outP, ne.index);
      const s = g.seams[ne.index] || 0;
      const F = ne.foot;
      const E = [F[0] + nn[0] * s, F[1] + nn[1] * s];
      out.push(`<path d="M${f1(F[0] - nn[0] * 2 * u)},${f1(F[1] - nn[1] * 2 * u)}L${f1(E[0])},${f1(E[1])}" stroke="#1f1f1f" stroke-width="${f1(0.45 * u)}"/>`);
      const tw = 1.8 * u, tl = 3 * u, px = -nn[1], py = nn[0];
      out.push(`<path d="M${f1(E[0] + px * tw)},${f1(E[1] + py * tw)}L${f1(E[0] - nn[0] * tl)},${f1(E[1] - nn[1] * tl)}L${f1(E[0] - px * tw)},${f1(E[1] - py * tw)}Z" fill="#1f1f1f"/>`);
    } else if (m.type === 'dot' && m.at) {
      const P = [m.at[0] + x, m.at[1] + y];
      out.push(`<circle cx="${f1(P[0])}" cy="${f1(P[1])}" r="${f1(1.6 * u)}" fill="#1f1f1f"/>`);
      if (m.label && o.mode !== 'overview') out.push(text(P[0] + 3 * u, P[1], m.label, 3.2 * u, { baseline: 'central', halo: true }));
    } else if (m.type === 'line' && m.pts) {
      const P = tr(m.pts);
      out.push(`<path d="${pathD(P, !!m.closed)}" fill="none" stroke="#444" stroke-width="${f1(0.4 * u)}" stroke-dasharray="${f1(3 * u)} ${f1(1.5 * u)}"/>`);
      if (m.label && o.mode !== 'overview') {
        const a = P[0], b = P[P.length > 1 ? 1 : 0];
        const mx = P.length === 2 ? (a[0] + b[0]) / 2 : a[0], my = P.length === 2 ? (a[1] + b[1]) / 2 : a[1];
        out.push(text(mx, my - 1.4 * u, m.label, 3 * u, { anchor: P.length === 2 ? 'middle' : 'start', rot: P.length === 2 ? upright(b[0] - a[0], b[1] - a[1]) : 0, halo: true }));
      }
    } else if (m.type === 'text' && m.at && o.mode !== 'overview') {
      const P = [m.at[0] + x, m.at[1] + y];
      out.push(text(P[0], P[1], m.text || m.label || '', (m.size || 3.2) * u, { anchor: m.anchor || 'middle', baseline: 'central', halo: true }));
    }
  }
  // 名前(まっすぐ立てて書く)
  const ob = bbox(outP);
  const lines = [pc.name, countText(pc)];
  if (o.seamText) lines.push(o.seamText);
  const [fw, fh] = finishedSize(pc);
  lines.push(`できあがり ${cm(fw)} × ${cm(fh)} cm`);
  const rel = [1, 0.62, 0.45, 0.45].slice(0, lines.length);
  const availW = ob.w * 0.78, availH = ob.h * 0.62;
  const maxF = o.maxName || 14;
  let F = maxF;
  for (let i = 0; i < lines.length; i++) F = Math.min(F, availW / (textW(lines[i]) * rel[i]));
  F = Math.min(F, availH / (rel.reduce((s, v) => s + v, 0) * 1.3));
  F = Math.max(F, o.minName || 3);
  const [cx, cy] = g.labelAt ? [g.labelAt[0] + x, g.labelAt[1] + y] : centroid(outP); // piece.labelAt で置き場所を決められる
  const totalH = rel.reduce((s, v) => s + v * F * 1.3, 0);
  let yy = cy - totalH / 2;
  for (let i = 0; i < lines.length; i++) {
    const fs = F * rel[i];
    yy += fs * 1.3;
    out.push(text(cx, yy - fs * 0.3, lines[i], fs, { anchor: 'middle', weight: i === 0 ? 'bold' : (i === 1 ? 'bold' : null), fill: i === 1 ? '#7a3b12' : '#222', halo: true }));
  }
  if (o.num) {
    const r = Math.max(F * 0.75, 4 * u);
    const bx = ob.x + r * 1.3, by = ob.y + r * 1.3;
    out.push(`<circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(r)}" fill="#2b2b2b"/>`);
    out.push(text(bx, by, String(o.num), r * 1.15, { anchor: 'middle', baseline: 'central', fill: '#fff', weight: 'bold' }));
  }
  out.push('</g>');
  return out.join('');
}

function seamTextFor(pieces) {
  const u = uniformSeam(pieces);
  return u ? `縫い代 ${cm(u)}cm つき` : '縫い代つき';
}

// ---------- 画面用の全体図 ----------
export function overviewSVG(bag, sizeKey, opts = {}) {
  const pieces = getPieces(bag, sizeKey);
  const lay = layoutPieces(bag, sizeKey);
  const S = Math.max(lay.sheetW, lay.sheetH * 1.1, 300);
  const u = S / 260;                 // 線の太さ・印の大きさ
  const fsL = (S / 24) * (opts.fontScale || 1); // 説明の文字
  const pad = fsL * 0.8;
  const seamText = seamTextFor(pieces);
  const fill = typeof opts.fabric === 'string' && /^#|^rgb/.test(opts.fabric) ? opts.fabric : '#fff';
  const W = Math.max(lay.sheetW, S * 0.9) + pad * 2;
  const body = [];
  // 見方(線の説明)
  let y = pad;
  const keyRows = [
    ['cut', 'いちばん外の太い線 … ここで切る'],
    ['fin', '内側の細い線 … 縫う線(できあがり)'],
    ...(pieces.some((p) => p.fold && !p.measureOnly) ? [['fold', '赤い点線 … わ(布を折って置く)']] : []),
  ];
  const kf = fsL * 0.72;
  for (const [k, label] of keyRows) {
    const yy = y + kf * 0.7;
    const st = k === 'cut' ? `stroke="#1f1f1f" stroke-width="${f1(kf * 0.14)}"` : k === 'fin' ? `stroke="#6b6b6b" stroke-width="${f1(kf * 0.06)}"` : `stroke="#a23b2a" stroke-width="${f1(kf * 0.16)}" stroke-dasharray="${f1(kf * 0.7)} ${f1(kf * 0.25)} ${f1(kf * 0.15)} ${f1(kf * 0.25)}"`;
    body.push(`<path d="M${f1(pad)},${f1(yy)}h${f1(kf * 3)}" ${st}/>`);
    body.push(text(pad + kf * 3.6, yy, label, kf, { baseline: 'central' }));
    y += kf * 1.55;
  }
  y += pad * 0.6;
  const top = y;
  const numOf = new Map();
  pieces.forEach((p, i) => numOf.set(p, i + 1));
  for (const it of lay.items) body.push(pieceSVG(it.geom, pad + it.x, top + it.y, { mode: 'overview', u, seamText, num: numOf.get(it.piece), maxName: fsL * 1.6, minName: fsL * 0.35, fill }));
  y = top + lay.sheetH + pad * 1.2;
  // 一覧
  const maxChars = Math.max(10, Math.floor((W - pad * 2) / fsL) - 2);
  for (const pc of pieces) {
    const n = numOf.get(pc);
    const r = fsL * 0.62;
    body.push(`<circle cx="${f1(pad + r)}" cy="${f1(y + fsL * 0.55)}" r="${f1(r)}" fill="#2b2b2b"/>`);
    body.push(text(pad + r, y + fsL * 0.55, String(n), fsL * 0.8, { anchor: 'middle', baseline: 'central', fill: '#fff', weight: 'bold' }));
    body.push(text(pad + r * 2 + fsL * 0.4, y + fsL * 0.55, `${pc.name}  ${countText(pc)}`, fsL, { baseline: 'central', weight: 'bold' }));
    y += fsL * 1.35;
    let sub;
    if (pc.measureOnly) {
      const b = bbox(pc.outline);
      sub = `型紙なし。布に直接 線を引いて ${cm(b.w)}cm × ${cm(b.h)}cm に切る`;
    } else {
      const [fw, fh] = finishedSize(pc);
      sub = `できあがり ${cm(fw)} × ${cm(fh)} cm` + (pc.fold ? '(わで切ると この大きさ)' : '');
    }
    for (const line of wrap(sub, maxChars / 0.8)) {
      body.push(text(pad + r * 2 + fsL * 0.4, y + fsL * 0.4, line, fsL * 0.78, { baseline: 'central', fill: '#444' }));
      y += fsL * 1.1;
    }
    y += fsL * 0.35;
  }
  const H = y + pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(H)}" width="100%" role="img" aria-label="${esc(bag.name)} ${esc(sizeKey)}サイズの型紙の全体図" font-family="${esc(FONT)}"><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/>${body.join('')}</svg>`;
}

function wrap(s, maxW) {
  const out = [];
  let cur = '', w = 0;
  for (const ch of String(s)) {
    const cw = textW(ch);
    if (w + cw > maxW && cur) { out.push(cur); cur = ''; w = 0; }
    cur += ch; w += cw;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- 印刷 ----------
function headerLines(bag, sizeKey, pieces) {
  const p = sizeOf(bag, sizeKey);
  const lines = [];
  const dim = typeof bag.sizeText === 'function' ? bag.sizeText(p)
    : [p.w && `よこ ${cm(p.w)}cm`, p.h && `たて ${cm(p.h)}cm`, p.d && `マチ ${cm(p.d)}cm`].filter(Boolean).join(' × ');
  if (dim) lines.push(`できあがり: ${dim}`);
  const u = uniformSeam(pieces);
  lines.push(u ? `縫い代(${cm(u)}cm)が ついています。` : '縫い代が ついています(場所により幅がちがいます)。');
  lines.push('いちばん外の 太い線で 切ってください。');
  lines.push('細い線は 縫う線(できあがり線)です。');
  lines.push('印刷は「実際のサイズ」か「100%」で。');
  const mo = pieces.filter((pc) => pc.measureOnly);
  if (mo.length) {
    lines.push('◇ 型紙なし(布に直接 線を引いて切る)');
    for (const pc of mo) { const b = bbox(pc.outline); lines.push(`・${pc.name}(${countText(pc)}) ${cm(b.w)} × ${cm(b.h)} cm`); }
  }
  return lines;
}

function headerSVG(bag, sizeKey, lines, W, H) {
  const o = [];
  o.push(`<rect x="0" y="0" width="${f1(W)}" height="${f1(H)}" rx="3" fill="#fff" stroke="#333" stroke-width="0.4"/>`);
  const title = `${bag.name}  ${sizeKey}サイズ の型紙`;
  o.push(text(5, 11, title, Math.min(7, (W - 66) / textW(title)), { weight: 'bold' })); // 5cm の四角にかからない大きさ
  let y = 19;
  for (const l of lines) { o.push(text(5, y, l, 3.9)); y += 6.2; }
  // 5cm の四角
  const sx = W - 57, sy = 7;
  o.push(`<rect x="${f1(sx)}" y="${f1(sy)}" width="50" height="50" fill="none" stroke="#000" stroke-width="0.5"/>`);
  o.push(text(sx + 25, sy + 16, 'この四角が', 3.6, { anchor: 'middle' }));
  o.push(text(sx + 25, sy + 23, 'たて・よこ', 3.6, { anchor: 'middle' }));
  o.push(text(sx + 25, sy + 31, '5cm', 7, { anchor: 'middle', weight: 'bold' }));
  o.push(text(sx + 25, sy + 39, 'なら 正しく', 3.6, { anchor: 'middle' }));
  o.push(text(sx + 25, sy + 45.5, '印刷できています', 3.4, { anchor: 'middle' }));
  o.push(text(sx + 25, sy + 55.5, '↑ 定規で測ってね', 3.2, { anchor: 'middle' }));
  return o.join('');
}

function tileFor(paper, orient) {
  const [pw, ph] = PAPERS[paper] || PAPERS.A4;
  const [W, H] = orient === 'landscape' ? [ph, pw] : [pw, ph];
  const tw = W - MARGIN * 2, th = H - MARGIN * 2;
  return { W, H, tw, th, sx: tw - GLUE, sy: th - GLUE };
}

// 並べた紙を、ページに切り分けたときの 使うページ
function pagesUsed(items, header, tile, sheetW, sheetH) {
  const cols = Math.max(1, Math.ceil((sheetW - GLUE) / tile.sx - 1e-9));
  const rows = Math.max(1, Math.ceil((sheetH - GLUE) / tile.sy - 1e-9));
  const used = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const R = { x: c * tile.sx, y: r * tile.sy, w: tile.tw, h: tile.th };
      let hit = header && header.x < R.x + R.w && header.x + header.w > R.x && header.y < R.y + R.h && header.y + header.h > R.y;
      if (!hit) for (const it of items) {
        if (it.x > R.x + R.w || it.x + it.w < R.x || it.y > R.y + R.h || it.y + it.h < R.y) continue;
        const poly = it.geom.cut.map((p) => [p[0] + it.x, p[1] + it.y]);
        if (polyHitsRect(poly, R)) { hit = true; break; }
      }
      row.push(hit);
    }
    used.push(row);
  }
  return { cols, rows, used, count: used.flat().filter(Boolean).length };
}

export function printPlan(bag, sizeKey, opts = {}) {
  const paper = PAPERS[opts.paper] ? opts.paper : 'A4';
  const pieces = getPieces(bag, sizeKey);
  const lines = headerLines(bag, sizeKey, pieces);
  let best = null;
  for (const orient of ['portrait', 'landscape']) {
    const tile = tileFor(paper, orient);
    const hw = Math.min(tile.tw, 186);
    const hh = Math.max(66, 22 + lines.length * 6.2);
    const header = { x: 0, y: 0, w: hw, h: hh };
    const preps = preparedFor(bag, sizeKey);
    const dims = preps.map((p) => bbox(p.cut));
    const minW = Math.max(hw, ...dims.map((b) => Math.min(b.w, b.h)));
    const c0 = Math.max(1, Math.ceil((minW - GLUE) / tile.sx - 1e-9));
    for (let cols = c0; cols <= c0 + 4; cols++) {
      const width = cols * tile.sx + GLUE;
      const lay = layoutPieces(bag, sizeKey, {
        width, tile, reserved: [header],
        score: (items, res) => pagesUsed(items, header, tile, width, Math.max(res.H, header.h)).count * 1e6 + res.H,
      });
      const sheetH = Math.max(lay.sheetH, header.h);
      const pu = pagesUsed(lay.items, header, tile, width, sheetH);
      const score = pu.count * 1e4 + pu.rows * pu.cols * 10 + (orient === 'portrait' ? 0 : 1);
      if (!best || score < best.score) best = { score, orient, tile, header, lay, pu, width, sheetH, lines };
    }
  }
  return { ...best, paper, pieces };
}

const ROW = (r) => (r < 26 ? String.fromCharCode(65 + r) : 'Z' + (r - 25));
export const pageLabel = (r, c) => `${ROW(r)}-${c + 1}`;

export function printPages(bag, sizeKey, opts = {}) {
  const plan = printPlan(bag, sizeKey, opts);
  const { tile, pu, lay, header, orient, paper } = plan;
  const [PW, PH] = PAPERS[paper];
  const seamText = seamTextFor(plan.pieces);
  const list = [];
  for (let r = 0; r < pu.rows; r++) for (let c = 0; c < pu.cols; c++) if (pu.used[r][c]) list.push([r, c]);
  const total = list.length;
  const has = (r, c) => r >= 0 && c >= 0 && r < pu.rows && c < pu.cols && pu.used[r][c];
  const pieceLayer = lay.items.map((it) => ({ it, svg: pieceSVG(it.geom, it.x, it.y, { mode: 'print', u: 1, seamText, maxName: 12, minName: 3.5 }) }));
  const id0 = `pp${++uid}`;
  const pages = list.map(([r, c], k) => {
    const id = `${id0}-${k}`;
    const ox = c * tile.sx, oy = r * tile.sy;
    const R = { x: ox, y: oy, w: tile.tw, h: tile.th };
    const o = [];
    o.push(`<defs><clipPath id="${id}-c"><rect x="${MARGIN}" y="${MARGIN}" width="${f1(tile.tw)}" height="${f1(tile.th)}"/></clipPath>`
      + `<pattern id="${id}-h" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#f4f4f4"/><path d="M0,0V3" stroke="#c9c9c9" stroke-width="0.6"/></pattern></defs>`);
    o.push(`<g clip-path="url(#${id}-c)"><g transform="translate(${f1(MARGIN - ox)} ${f1(MARGIN - oy)})">`);
    // のりしろ(右・下に となりのページがあるとき)
    if (has(r, c + 1)) {
      o.push(`<rect x="${f1(ox + tile.sx)}" y="${f1(oy)}" width="${GLUE}" height="${f1(tile.th)}" fill="url(#${id}-h)"/>`);
      o.push(text(ox + tile.sx + GLUE / 2, oy + tile.th / 2, `のりしろ  ${pageLabel(r, c + 1)} をここに重ねて貼る`, 3.2, { anchor: 'middle', baseline: 'central', rot: -90, fill: '#777' }));
    }
    if (has(r + 1, c)) {
      o.push(`<rect x="${f1(ox)}" y="${f1(oy + tile.sy)}" width="${f1(tile.tw)}" height="${GLUE}" fill="url(#${id}-h)"/>`);
      o.push(text(ox + tile.tw / 2, oy + tile.sy + GLUE / 2, `のりしろ  ${pageLabel(r + 1, c)} をここに重ねて貼る`, 3.2, { anchor: 'middle', baseline: 'central', fill: '#777' }));
    }
    // パーツ
    for (const { it, svg } of pieceLayer) {
      if (it.x > R.x + R.w || it.x + it.w < R.x || it.y > R.y + R.h || it.y + it.h < R.y) continue;
      o.push(svg);
    }
    if (r === 0 && c === 0) o.push(headerSVG(bag, sizeKey, plan.lines, header.w, header.h));
    // 合わせ印 ◆(重なるところのまん中)
    const dia = (x, y) => `<path d="M${f1(x)},${f1(y - 3)}L${f1(x + 3)},${f1(y)}L${f1(x)},${f1(y + 3)}L${f1(x - 3)},${f1(y)}Z" fill="#111"/>`;
    for (const [rr, cc] of [[r, c], [r, c - 1]]) {
      if (has(rr, cc) && has(rr, cc + 1)) {
        const x = (cc + 1) * tile.sx + GLUE / 2;
        for (const f of [0.3, 0.7]) o.push(dia(x, rr * tile.sy + tile.th * f));
      }
    }
    for (const [rr, cc] of [[r, c], [r - 1, c]]) {
      if (has(rr, cc) && has(rr + 1, cc)) {
        const y = (rr + 1) * tile.sy + GLUE / 2;
        for (const f of [0.3, 0.7]) o.push(dia(cc * tile.sx + tile.tw * f, y));
      }
    }
    o.push('</g></g>');
    // 印刷できる範囲のふち
    o.push(`<rect x="${MARGIN}" y="${MARGIN}" width="${f1(tile.tw)}" height="${f1(tile.th)}" fill="none" stroke="#999" stroke-width="0.25"/>`);
    // 切るところ(左・上にとなりがあるとき)
    const cutNotes = [];
    if (has(r, c - 1)) {
      o.push(`<path d="M${MARGIN},${MARGIN}V${f1(MARGIN + tile.th)}" stroke="#000" stroke-width="0.5" stroke-dasharray="2 1.2"/>`);
      o.push(text(MARGIN / 2 + 0.6, MARGIN + tile.th / 2, '✂ この線で切る', 3, { anchor: 'middle', baseline: 'central', rot: -90 }));
      cutNotes.push(`左のふちを線で切り、${pageLabel(r, c - 1)} の網かけに重ねて ◆ を合わせて貼る`);
    }
    if (has(r - 1, c)) {
      o.push(`<path d="M${MARGIN},${MARGIN}H${f1(MARGIN + tile.tw)}" stroke="#000" stroke-width="0.5" stroke-dasharray="2 1.2"/>`);
      cutNotes.push(`上のふちを線で切り、${pageLabel(r - 1, c)} の網かけに重ねて ◆ を合わせて貼る`);
    }
    if (!cutNotes.length) cutNotes.push(total > 1 ? 'このページは切らずに使います。ほかのページを この上に重ねて貼ります。' : 'この1枚で型紙ができあがります。');
    // 上の余白: ページ番号・全体の中のどこか
    o.push(text(MARGIN, MARGIN - 2.2, pageLabel(r, c), 6, { weight: 'bold' }));
    o.push(text(MARGIN + 15, MARGIN - 2.6, `(全部で ${total}枚・${k + 1}枚目) ${bag.name} ${sizeKey}`, 3, { fill: '#444' }));
    const cs = Math.min(6.4 / pu.rows, 34 / pu.cols, 4.2);
    const mx = MARGIN + tile.tw - cs * pu.cols, my = MARGIN - 1.2 - cs * pu.rows;
    o.push(text(mx - 1.5, MARGIN - 2.6, '貼り方の図', 2.6, { anchor: 'end', fill: '#444' }));
    for (let rr = 0; rr < pu.rows; rr++) for (let cc = 0; cc < pu.cols; cc++) {
      if (!pu.used[rr][cc]) continue;
      const me = rr === r && cc === c;
      o.push(`<rect x="${f1(mx + cc * cs)}" y="${f1(my + rr * cs)}" width="${f1(cs)}" height="${f1(cs)}" fill="${me ? '#222' : '#fff'}" stroke="#222" stroke-width="0.25"/>`);
    }
    // 下の余白: 貼り方
    let by = tile.H - MARGIN + 4.2;
    for (const n of cutNotes.slice(0, 2)) { o.push(text(MARGIN, by, n, 3, { fill: '#333' })); by += 3.6; }
    const content = o.join('');
    const inner = orient === 'landscape' ? `<g transform="translate(${PW} 0) rotate(90)">${content}</g>` : content;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="${esc(FONT)}" data-page="${pageLabel(r, c)}"><rect width="${PW}" height="${PH}" fill="#fff"/>${inner}</svg>`;
  });
  return {
    pages, cols: pu.cols, rows: pu.rows, paper, orientation: orient,
    labels: list.map(([r, c]) => pageLabel(r, c)),
    map: pu.used.map((row, r) => row.map((u, c) => (u ? pageLabel(r, c) : null))),
  };
}

// ---------- 布の量 ----------
const FABRIC_W = 1100;  // 布の幅 110cm
const SELVAGE = 10;     // 耳(はし)は使わない

export function materials(bag, sizeKey) {
  const pieces = getPieces(bag, sizeKey);
  const by = {};
  for (const pc of pieces) {
    if (!pc.outline || pc.outline.length < 2) continue;
    let w, h;
    if (pc.measureOnly) { const b = bbox(pc.outline); w = b.w; h = b.h; }
    else {
      const full = pc.fold ? mirror(pc.outline, pc.fold) : pc.outline;
      const fullSeam = pc.fold ? offset(full, Array.isArray(pc.seam) ? Math.max(...pc.seam) : pc.seam) : cutOutline(pc);
      const b = bbox(fullSeam); w = b.w; h = b.h;
    }
    for (const c of cutsOf(pc)) {
      (by[c.fabric] ||= { rects: [], parts: [] });
      for (let i = 0; i < c.cut; i++) by[c.fabric].rects.push({ key: by[c.fabric].rects.length, w, h, rot: !!pc.measureOnly }); // 布目を守るため 型紙は回さない(ひもは回してよい)
      by[c.fabric].parts.push(`${pc.name} ${c.cut}${pc.measureOnly ? '本' : '枚'}`);
    }
  }
  const out = [];
  for (const fab of Object.keys(by).sort((a, b) => FABRIC_ORDER.indexOf(a) - FABRIC_ORDER.indexOf(b))) {
    const { rects, parts } = by[fab];
    const W = FABRIC_W - SELVAGE * 2;
    let H = Infinity;
    for (const ord of ORDERS) H = Math.min(H, pack(rects.slice().sort(ord), W, { gap: 5 }).H);
    const lenCm = Math.max(20, Math.ceil((H * 1.05 + 40) / 50) * 5);
    // はぎれで足りるか(小さい布)
    let small = null;
    const sumA = rects.reduce((s, r) => s + r.w * r.h, 0);
    const maxD = Math.max(...rects.map((r) => Math.max(r.w, r.h)));
    for (let w2 = Math.max(...rects.map((r) => (r.rot ? Math.min(r.w, r.h) : r.w))); w2 <= W; w2 += 20) {
      let h2 = Infinity;
      for (const ord of ORDERS) h2 = Math.min(h2, pack(rects.slice().sort(ord), w2, { gap: 5 }).H);
      const A = (w2 + 30) * (h2 + 30);
      if (!small || A < small.A) small = { A, w: w2 + 30, h: h2 + 30 };
      if (w2 > maxD * 2.5 && w2 > Math.sqrt(sumA) * 2) break;
    }
    const name = FABRIC_NAME[fab] || fab;
    let note = parts.join('・');
    if (small && small.w <= 600 && small.h <= 600) note += `(${Math.ceil(small.w / 10)}cm × ${Math.ceil(small.h / 10)}cm の はぎれでも足ります)`;
    out.push({ fabric: fab, name, widthCm: 110, lengthCm: lenCm, size: `幅110cm × ${lenCm}cm`, note });
  }
  return out;
}

// ---------- しらべる(縫い合わせる辺の長さ) ----------
// bag.matches(p) => [{label, a:{piece, from, to, times}, b:{…}, tol}]  from/to は点の番号。省くと一周。
export function checkMatches(bag, sizeKey) {
  if (typeof bag.matches !== 'function') return [];
  const p = sizeOf(bag, sizeKey);
  const pieces = bag.pieces(p);
  const find = (id) => pieces.find((pc) => pc.id === id);
  const len = (ref) => {
    const pc = find(ref.piece);
    if (!pc) return NaN;
    const o = pc.outline;
    let L;
    if (ref.from == null) { L = 0; for (let i = 0; i < o.length; i++) L += Math.hypot(o[(i + 1) % o.length][0] - o[i][0], o[(i + 1) % o.length][1] - o[i][1]); }
    else {
      L = 0; const n = o.length; let i = ((ref.from % n) + n) % n; const end = ((ref.to % n) + n) % n;
      while (i % n !== end) { const a = o[i % n], b = o[(i + 1) % n]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); i++; }
    }
    return L * (ref.times || 1);
  };
  return bag.matches(p).map((m) => {
    const A = len(m.a), B = len(m.b);
    const tol = m.tol ?? 1;
    return { label: m.label, a: A, b: B, diff: A - B, ok: Math.abs(A - B) <= tol };
  });
}

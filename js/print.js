// print.js — 型紙を並べる・全体図・印刷ページ・布の量(型紙係)
// 単位は mm。SVG の viewBox も mm なので、印刷すると原寸になる。
import {
  offset, bbox, foldEdges, mirror, nearestEdge, edgeNormal, polyHitsRect, pointInPoly, centroid, cm,
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

// 回して(0 / 90 / 180 / 270・時計まわり)、切る線の左上を (0,0) にする
const ROT = {
  0: ([x, y]) => [x, y], 90: ([x, y]) => [-y, x], 180: ([x, y]) => [-x, -y], 270: ([x, y]) => [y, -x],
};
function place(prep, rot = 0) {
  rot = ((rot % 360) + 360) % 360;
  const T = ROT[rot] || ROT[0];
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
  return cutsOf(piece).map((c) => `${FABRIC_NAME[c.fabric] || c.fabric}${c.cut}${piece.unit || unit}`).join('・') + (piece.fold ? '(わ)' : '');
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
  (a, b) => b.h - a.h,
  (a, b) => b.w - a.w,
];

function preparedFor(bag, sizeKey) {
  return getPieces(bag, sizeKey).filter((pc) => !pc.measureOnly && pc.outline && pc.outline.length >= 3).map(prepare);
}

function itemsFrom(preps, res) {
  return res.placed.map((pl) => {
    const prep = preps[pl.key];
    const g = place(prep, pl.rotate);
    return { piece: prep.piece, x: pl.x, y: pl.y, rotate: pl.rotate, w: g.w, h: g.h, geom: g, prep };
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
// o: { mode:'print'|'overview', u: 線と文字の基準(mm), fill, num, simple(名前だけ), fitsPage(印刷: 1ページに収まるか) }
function pieceSVG(g, x, y, o) {
  const u = o.u || 1;
  const pc = g.piece;
  const print = o.mode !== 'overview';
  const out = [`<g data-piece="${esc(pc.id || '')}">`];
  const tr = (pts) => pts.map((p) => [p[0] + x, p[1] + y]);
  const cutP = tr(g.cut), outP = tr(g.outline);
  // 型紙といっしょに回る向き(180° は読めないので 0° にする)
  const rot = g.rot || 0, rot180 = rot === 180;
  const textRot = rot === 90 ? 90 : rot === 270 ? -90 : 0;
  const dirOf = (v) => ROT[rot](v);
  // 印刷: 文字がページの境目(のりしろ)で切れないよう、近くの 1ページに収まる所へずらす
  const T = (tx, ty, s, size, opt = {}) => {
    if (print && o.fitsPage) {
      const w = textW(s) * size * 1.05, h = size * 1.25;
      const a = ((opt.rot || 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      const ax = opt.anchor === 'middle' ? -w / 2 : opt.anchor === 'end' ? -w : 0;
      const ay = opt.baseline === 'central' ? -h / 2 : -size * 0.95;
      const corners = [[ax, ay], [ax + w, ay], [ax + w, ay + h], [ax, ay + h]].map(([px, py]) => [px * ca - py * sa, px * sa + py * ca]);
      const bx = Math.min(...corners.map((c) => c[0])), by = Math.min(...corners.map((c) => c[1]));
      const bw = Math.max(...corners.map((c) => c[0])) - bx, bh = Math.max(...corners.map((c) => c[1])) - by;
      const fits = (dx, dy) => o.fitsPage({ x: tx + dx + bx, y: ty + dy + by, w: bw, h: bh }, true);
      if (!fits(0, 0)) {
        const dirs = [[ca, sa], [-ca, -sa], [-sa, ca], [sa, -ca]];
        found: for (let d = 2; d <= 60; d += 2) for (const [ux, uy] of dirs) if (fits(ux * d, uy * d)) { tx += ux * d; ty += uy * d; break found; }
      }
    }
    return text(tx, ty, s, size, opt);
  };
  if (!print) {
    out.push(`<path d="${pathD(cutP)}" fill="${FABRIC_TINT[pc.fabric] || '#eee'}" stroke="none"/>`);
    out.push(`<path d="${pathD(outP)}" fill="${o.fill || '#fff'}" stroke="none"/>`);
  }
  // 切る線(太い実線)
  for (const s of cutSegments(g)) out.push(`<path d="${pathD(tr(s.pts), s.closed)}" fill="none" stroke="#1f1f1f" stroke-width="${f1(0.7 * u)}" stroke-linejoin="round" stroke-linecap="round"/>`);
  // できあがり線(細い実線)
  out.push(`<path d="${pathD(outP)}" fill="none" stroke="#6b6b6b" stroke-width="${f1(0.3 * u)}" stroke-linejoin="round"/>`);
  // わ(字は いつも まっすぐ立てる)
  for (const run of g.folds) {
    const R = tr(run);
    out.push(`<path d="${pathD(R, false)}" fill="none" stroke="#a23b2a" stroke-width="${f1(0.9 * u)}" stroke-dasharray="${f1(6 * u)} ${f1(2 * u)} ${f1(1.2 * u)} ${f1(2 * u)}"/>`);
    const a = R[0], b = R[R.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 20 * u) continue;
    const f = print ? 0.5 : 0.12; // 全体図では はしの近く(名前と重ならないように)
    const mx = a[0] + (b[0] - a[0]) * f, my = a[1] + (b[1] - a[1]) * f;
    const nn = edgeNormal(outP, nearestEdge(outP, [mx, my]).index);
    if (print) {
      const lines = [['わ', 8, 'bold'], ['布を折る線', 4, 'bold'], ['(切らない)', 4, null]];
      const bw = 22, bh = 19;
      const off = Math.abs(nn[0]) * (bw / 2 + 3) + Math.abs(nn[1]) * (bh / 2 + 3);
      const cx0 = mx - nn[0] * off, cy0 = my - nn[1] * off;
      let yy = cy0 - bh / 2;
      for (const [t, s, wgt] of lines) { yy += s * 1.15; out.push(T(cx0, yy - s * 0.15, t, s, { anchor: 'middle', fill: '#a23b2a', weight: wgt, halo: true })); }
    } else {
      const fs = Math.min(6 * u, L / 8) * 1.4;
      const off = fs * 0.9;
      out.push(text(mx - nn[0] * off, my - nn[1] * off, 'わ', fs, { anchor: 'middle', baseline: 'central', fill: '#a23b2a', weight: 'bold', halo: true }));
    }
  }
  // 布目
  if (g.grain) {
    const [p, q] = tr(g.grain);
    const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, hs = 3.5 * u;
    const head = (P, sx) => `M${f1(P[0] - sx * ux * hs - uy * hs * 0.5)},${f1(P[1] - sx * uy * hs + ux * hs * 0.5)}L${f1(P[0])},${f1(P[1])}L${f1(P[0] - sx * ux * hs + uy * hs * 0.5)},${f1(P[1] - sx * uy * hs - ux * hs * 0.5)}`;
    out.push(`<path d="M${f1(p[0])},${f1(p[1])}L${f1(q[0])},${f1(q[1])}${head(q, 1)}${head(p, -1)}" fill="none" stroke="#2c5d8a" stroke-width="${f1(0.6 * u)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    if (print) out.push(T((p[0] + q[0]) / 2 - uy * 3.6, (p[1] + q[1]) / 2 + ux * 3.6, '布目(布のたて糸の向き)', 3.8, { anchor: 'middle', baseline: 'central', rot: upright(dx, dy), fill: '#1f4a70', halo: true }));
  }
  // 印
  const LS = 3.8; // 印の説明の字(mm)
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
      if (m.label && print) {
        // 型紙の「右」へ書く(回したときは いっしょに回す。逆さまにはしない)
        const [dx, dy] = dirOf([1, 0]);
        out.push(T(P[0] + dx * 3, P[1] + dy * 3, m.label, LS, { baseline: 'central', rot: textRot, anchor: rot180 ? 'end' : 'start', halo: true }));
      }
    } else if (m.type === 'line' && m.pts) {
      const P = tr(m.pts);
      out.push(`<path d="${pathD(P, !!m.closed)}" fill="none" stroke="#444" stroke-width="${f1(0.4 * u)}" stroke-dasharray="${f1(3 * u)} ${f1(1.5 * u)}"/>`);
      if (m.label && print) {
        const up = dirOf([0, -1]); // 型紙の「上」
        if (P.length === 2) {
          // 2点の線: 線のまん中、線から垂直に少し離して、線に沿って書く
          const [a, b] = P;
          const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
          let nx = -dy / L, ny = dx / L;
          // 線の「上」がわ(たての線なら「左」がわ)へ離す
          const ref = Math.abs(nx * up[0] + ny * up[1]) < 0.2 ? dirOf([-1, 0]) : up;
          if (nx * ref[0] + ny * ref[1] < 0) { nx = -nx; ny = -ny; }
          const off = LS * 0.95;
          out.push(T((a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off, m.label, LS, { anchor: 'middle', baseline: 'central', rot: upright(dx, dy), halo: true }));
        } else {
          // 四角など: 最初の点の少し「上」に書く
          const a = P[0];
          out.push(T(a[0] + up[0] * LS, a[1] + up[1] * LS, m.label, LS, { anchor: rot180 ? 'end' : 'start', baseline: 'central', rot: textRot, halo: true }));
        }
      }
    } else if (m.type === 'text' && m.at && print) {
      const P = [m.at[0] + x, m.at[1] + y];
      let t = m.text || m.label || '';
      if (rot180) t = t.replace(/[↑↓←→]/g, (c) => ({ '↑': '↓', '↓': '↑', '←': '→', '→': '←' })[c]);
      out.push(T(P[0], P[1], t, Math.max(LS, m.size || 0), { anchor: m.anchor || 'middle', baseline: 'central', rot: textRot, halo: true }));
    }
  }
  // 名前(まっすぐ立てて書く)
  const ob = bbox(outP);
  const lines = [pc.name];
  if (!o.simple) {
    lines.push(countText(pc));
    if (o.seamText) lines.push(o.seamText);
    const [fw, fh] = finishedSize(pc);
    lines.push(`できあがり ${cm(fw)}×${cm(fh)}cm`);
  }
  const rel = [1, 0.62, 0.45, 0.45].slice(0, lines.length);
  const availW = ob.w * 0.78, availH = ob.h * 0.62;
  const maxF = o.maxName || 14;
  let F = maxF;
  for (let i = 0; i < lines.length; i++) F = Math.min(F, availW / (textW(lines[i]) * rel[i]));
  F = Math.min(F, availH / (rel.reduce((s, v) => s + v, 0) * 1.3));
  F = Math.max(F, o.minName || 3);
  const totalH = rel.reduce((s, v) => s + v * F * 1.3, 0);
  const blockW = Math.max(...lines.map((l, i) => textW(l) * F * rel[i])) * 1.08 + 2;
  // piece.labelAt で置き場所を決められる。パーツの外なら まん中へ。はみ出さないように寄せる。
  let [cx, cy] = centroid(outP);
  if (g.labelAt) {
    const L = [g.labelAt[0] + x, g.labelAt[1] + y];
    if (pointInPoly(L, outP)) [cx, cy] = L;
  }
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  cx = clamp(cx, ob.x + blockW / 2 + 2 * u, ob.x + ob.w - blockW / 2 - 2 * u);
  cy = clamp(cy, ob.y + totalH / 2 + 2 * u, ob.y + ob.h - totalH / 2 - 2 * u);
  // 印刷: 名前がページの境目(のりしろ)にかからない場所を探す(パーツの中で、近いところ)
  if (o.fitsPage) {
    const inside = (X, Y) => [[X - blockW / 2, Y - totalH / 2], [X + blockW / 2, Y - totalH / 2], [X + blockW / 2, Y + totalH / 2], [X - blockW / 2, Y + totalH / 2], [X, Y]]
      .every((q) => pointInPoly(q, outP));
    const ok = (X, Y) => inside(X, Y) && o.fitsPage({ x: X - blockW / 2, y: Y - totalH / 2, w: blockW, h: totalH });
    if (!ok(cx, cy)) {
      let bestP = null;
      for (let X = ob.x + blockW / 2; X <= ob.x + ob.w - blockW / 2; X += 5) {
        for (let Y = ob.y + totalH / 2; Y <= ob.y + ob.h - totalH / 2; Y += 5) {
          const d = Math.hypot(X - cx, Y - cy);
          if (bestP && d >= bestP.d) continue;
          if (ok(X, Y)) bestP = { X, Y, d };
        }
      }
      if (bestP) { cx = bestP.X; cy = bestP.Y; }
    }
  }
  let yy = cy - totalH / 2;
  for (let i = 0; i < lines.length; i++) {
    const fs = F * rel[i];
    yy += fs * 1.3;
    out.push(text(cx, yy - fs * 0.3, lines[i], fs, { anchor: 'middle', weight: i <= 1 ? 'bold' : null, fill: i === 1 ? '#7a3b12' : '#222', halo: true }));
  }
  if (o.num) {
    const r = Math.max(o.simple ? F * 0.9 : F * 0.75, 4 * u);
    const bx = ob.x + r * 1.3, by = ob.y + r * 1.3;
    out.push(`<circle cx="${f1(bx)}" cy="${f1(by)}" r="${f1(r)}" fill="#2b2b2b"/>`);
    out.push(text(bx, by, String(o.num), r * 1.15, { anchor: 'middle', baseline: 'central', fill: '#fff', weight: 'bold' }));
  }
  out.push('</g>');
  return out.join('');
}

function seamTextFor(pieces) {
  const u = uniformSeam(pieces);
  return u ? `縫い代${cm(u)}cmつき` : '縫い代つき';
}

// 布に直接、線を引いて切るパーツの小さな図(寸法つき)
function measureSVG(pc, b, x, y, sx, sy, fs, num, lf = 0.62) {
  const T = (p) => [x + (p[0] - b.minX) * sx, y + (p[1] - b.minY) * sy];
  const P = pc.outline.map(T);
  const o = [`<g data-piece="${esc(pc.id || '')}">`];
  o.push(`<path d="${pathD(P)}" fill="${FABRIC_TINT[pc.fabric] || '#eee'}" stroke="#1f1f1f" stroke-width="${f1(fs * 0.08)}" stroke-linejoin="round"/>`);
  for (const m of pc.marks || []) {
    if (m.type === 'line' && m.pts) o.push(`<path d="${pathD(m.pts.map(T), !!m.closed)}" fill="none" stroke="#555" stroke-width="${f1(fs * 0.04)}" stroke-dasharray="${f1(fs * 0.25)} ${f1(fs * 0.15)}"/>`);
    if (m.type === 'notch' && m.at) {
      const Q = T(m.at);
      const ne = nearestEdge(P, Q);
      const nn = edgeNormal(P, ne.index);
      const F = ne.foot, tw = fs * 0.2, tl = fs * 0.32, px = -nn[1], py = nn[0];
      o.push(`<path d="M${f1(F[0] + px * tw)},${f1(F[1] + py * tw)}L${f1(F[0] - nn[0] * tl)},${f1(F[1] - nn[1] * tl)}L${f1(F[0] - px * tw)},${f1(F[1] - py * tw)}Z" fill="#1f1f1f"/>`);
    }
    if (m.type === 'dot' && m.at) { const Q = T(m.at); o.push(`<circle cx="${f1(Q[0])}" cy="${f1(Q[1])}" r="${f1(fs * 0.12)}" fill="#1f1f1f"/>`); }
  }
  const bw = b.w * sx, bh = b.h * sy;
  o.push(text(x + bw / 2, y - fs * 0.45, `よこ${cm(b.w)}cm`, fs * lf, { anchor: 'middle', fill: '#333' }));
  o.push(text(x + bw + fs * 0.35, y + bh / 2, `たて${cm(b.h)}cm`, fs * lf, { baseline: 'central', fill: '#333' }));
  if (num) {
    const r = fs * 0.5;
    o.push(`<circle cx="${f1(x - r - fs * 0.3)}" cy="${f1(y + bh / 2)}" r="${f1(r)}" fill="#2b2b2b"/>`);
    o.push(text(x - r - fs * 0.3, y + bh / 2, String(num), r * 1.2, { anchor: 'middle', baseline: 'central', fill: '#fff', weight: 'bold' }));
  }
  o.push('</g>');
  return o.join('');
}

// ---------- 画面用の全体図 ----------
// opts: { fabric:'#色', fontScale, list:true|false }
//   list:false → 図の下の一覧と 線の見方を出さない。図の中は 大きな番号と パーツ名だけ(一覧は画面が HTML で出す)。
export function overviewSVG(bag, sizeKey, opts = {}) {
  const showList = opts.list !== false;
  const pieces = getPieces(bag, sizeKey);
  const lay = layoutPieces(bag, sizeKey);
  const S = Math.max(lay.sheetW, lay.sheetH * 1.1, 300);
  const u = S / 260;                 // 線の太さ・印の大きさ
  const fsL = (S / 24) * (opts.fontScale || (showList ? 1 : 1.6)); // 説明の文字
  const pad = fsL * 0.8;
  const seamText = seamTextFor(pieces);
  const fill = typeof opts.fabric === 'string' && /^#|^rgb/.test(opts.fabric) ? opts.fabric : '#fff';
  const W = Math.max(lay.sheetW, S * 0.9) + pad * 2;
  const body = [];
  let y = pad;
  // 見方(線の説明)
  if (showList && lay.items.length) {
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
  }
  const top = y;
  // 番号(layoutPieces は pieces() を別に呼ぶので、id で引く)
  const nums = new Map();
  pieces.forEach((p, i) => { if (!nums.has(p.id)) nums.set(p.id, i + 1); });
  const numOf = { get: (p) => nums.get(p.id) ?? (pieces.indexOf(p) + 1) };
  for (const it of lay.items) {
    body.push(pieceSVG(it.geom, pad + it.x, top + it.y, {
      mode: 'overview', u, seamText, num: numOf.get(it.piece), simple: !showList,
      maxName: fsL * (showList ? 1.6 : 1.2), minName: fsL * (showList ? 0.35 : 0.6), fill,
    }));
  }
  y = top + lay.sheetH + (lay.items.length ? pad * 1.2 : 0);
  // 布に直接、線を引いて切るもの(小さな寸法つきの図)
  const mo = pieces.filter((pc) => pc.measureOnly && pc.outline && pc.outline.length >= 3);
  if (mo.length) {
    if (showList) {
      body.push(text(pad, y + fsL * 0.5, '布に直接、線を引いて切るもの(型紙なし)', fsL * 0.85, { baseline: 'central', weight: 'bold' }));
      y += fsL * 1.4;
    }
    const lf = showList ? 0.62 : 0.75; // 寸法の字
    const availW = W - pad * 2 - fsL * 7;
    const bbs = mo.map((pc) => bbox(pc.outline));
    let sc = Infinity;
    for (const b of bbs) sc = Math.min(sc, (availW * 0.9) / Math.max(b.w, 1), (fsL * 5) / Math.max(b.h, 1));
    let x = pad, rowH = 0;
    mo.forEach((pc, i) => {
      const b = bbs[i];
      const sx = sc, sy = Math.max(sc, (fsL * 0.9) / Math.max(b.h, 1)); // 細い帯も見えるように
      const bw = b.w * sx, bh = b.h * sy;
      const blockW = bw + fsL * 6.5, blockH = bh + fsL * (showList ? 1.5 : 2.9);
      if (x > pad && x + blockW > W - pad) { x = pad; y += rowH + fsL * 0.6; rowH = 0; }
      const y0 = y + fsL * (showList ? 1.1 : 2.45);
      if (!showList) body.push(text(x + fsL * 1.6, y + fsL * 0.55, pc.name, fsL * 0.8, { baseline: 'central', weight: 'bold' }));
      body.push(measureSVG(pc, b, x + fsL * 1.6, y0, sx, sy, fsL, numOf.get(pc), lf));
      x += blockW + fsL; rowH = Math.max(rowH, blockH);
    });
    y += rowH + pad;
  }
  // 一覧
  if (showList) for (const pc of pieces) {
    const n = numOf.get(pc);
    const r = fsL * 0.62;
    const tx = pad + r * 2 + fsL * 0.4;
    const avail = W - pad - tx;
    body.push(`<circle cx="${f1(pad + r)}" cy="${f1(y + fsL * 0.55)}" r="${f1(r)}" fill="#2b2b2b"/>`);
    body.push(text(pad + r, y + fsL * 0.55, String(n), fsL * 0.8, { anchor: 'middle', baseline: 'central', fill: '#fff', weight: 'bold' }));
    // 1行目(名前と枚数): 長ければ字を少し小さく、それでも長ければ折り返す
    const head = `${pc.name}  ${countText(pc)}`;
    const hf = Math.max(fsL * 0.75, Math.min(fsL, avail / textW(head)));
    for (const line of wrap(head, avail / hf)) {
      body.push(text(tx, y + fsL * 0.55, line, hf, { baseline: 'central', weight: 'bold' }));
      y += hf * 1.3;
    }
    y += fsL * 0.05;
    let sub;
    if (pc.measureOnly) {
      const b = bbox(pc.outline);
      sub = `型紙なし。布に直接、線を引いて ${cm(b.w)}×${cm(b.h)}cmに切る`;
    } else {
      const [fw, fh] = finishedSize(pc);
      sub = `できあがり ${cm(fw)}×${cm(fh)}cm` + (pc.fold ? '(わで切ると、この大きさ)' : '');
    }
    for (const line of wrap(sub, avail / (fsL * 0.78))) {
      body.push(text(tx, y + fsL * 0.4, line, fsL * 0.78, { baseline: 'central', fill: '#444' }));
      y += fsL * 1.1;
    }
    y += fsL * 0.35;
  }
  const H = y + pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(H)}" width="100%" role="img" aria-label="${esc(bag.name)} ${esc(sizeLabel(sizeKey))}の型紙の全体図" font-family="${esc(FONT)}"><rect width="${f1(W)}" height="${f1(H)}" fill="#fff"/>${body.join('')}</svg>`;
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
// 紙の上の大きさの呼び名(画面とそろえる)
export const SIZE_LABEL = { S: '小(S)', M: '中(M)', L: '大(L)' };
const sizeLabel = (k) => SIZE_LABEL[k] || k;
const SQ = 52; // 5cm の四角のかたまり(四角 50mm + ふち)

// 1枚目の説明。lines: [{t: 文, s: 文字の大きさ(mm), b: 太字}]、square: 5cm の四角を出すか
function headerLines(bag, sizeKey, pieces) {
  const p = sizeOf(bag, sizeKey);
  const L = [];
  const dim = typeof bag.sizeText === 'function' ? bag.sizeText(p)
    : [p.w && `よこ${cm(p.w)}cm`, p.h && `たて${cm(p.h)}cm`, p.d && `マチ${cm(p.d)}cm`].filter(Boolean).join('×');
  const printed = pieces.filter((pc) => !pc.measureOnly && pc.outline && pc.outline.length >= 3);
  const mo = pieces.filter((pc) => pc.measureOnly && pc.outline && pc.outline.length >= 2);
  const moText = (pc) => { const b = bbox(pc.outline); return `${pc.name}(${countText(pc)}) よこ${cm(b.w)}cm×たて${cm(b.h)}cm`; };
  if (dim) L.push({ t: `できあがり: ${dim}`, s: 4.5 });
  if (!printed.length) {
    // 型紙を使わない袋: 寸法の一覧を大きく
    L.push({ t: 'この袋は型紙を使わず、布に直接、線を引いて切ります。', s: 5.5, b: true });
    L.push({ t: '下の大きさを、布に定規で引いて、その線で切ってください。', s: 4.5 });
    for (const pc of mo) L.push({ t: '・' + moText(pc), s: 6, b: true });
    return { lines: L, square: false };
  }
  const u = uniformSeam(pieces);
  L.push({ t: `${u ? `縫い代${cm(u)}cmつき` : '縫い代つき'}。いちばん外の太い線で切ります。細い線は縫う線です。`, s: 4.5 });
  if (mo.length) L.push({ t: '型紙なし(布に直接、線を引いて切る): ' + mo.map(moText).join('、'), s: 4.5 });
  return { lines: L, square: true };
}

// 説明を折り返して、高さを決める。withSq = 5cm の四角を説明の右に入れる(入らないときの形)
function headerLayout(info, W, withSq = false) {
  const side = info.square && withSq;
  const avail = side ? W - SQ - 10 : W - 8;
  const rows = [];
  let y = 12;
  for (const l of info.lines) for (const t of wrap(l.t, avail / l.s)) { y += l.s * 1.05; rows.push({ ...l, t, y }); y += l.s * 0.4; }
  const h = side ? Math.max(SQ + 6, y + 3) : y + 3;
  return { rows, square: info.square, side, sq: side ? { x: W - SQ - 3, y: 3 } : null, w: W, h };
}

function headerSVG(bag, sizeKey, hl, W, H) {
  const o = [];
  o.push(`<rect x="0" y="0" width="${f1(W)}" height="${f1(H)}" rx="2.5" fill="#fff" stroke="#333" stroke-width="0.4"/>`);
  const title = `${bag.name} ${sizeLabel(sizeKey)}の型紙`;
  o.push(text(4, 9, title, Math.min(6.5, (hl.side ? W - SQ - 10 : W - 8) / textW(title)), { weight: 'bold' }));
  for (const r of hl.rows) o.push(text(4, r.y, r.t, r.s, { weight: r.b ? 'bold' : null, fill: '#111' }));
  if (hl.sq) o.push(squareSVG(hl.sq.x, hl.sq.y));
  return o.join('');
}

// 5cm の四角(印刷の大きさを たしかめる)
function squareSVG(x, y) {
  const o = [`<rect x="${f1(x)}" y="${f1(y)}" width="${SQ}" height="${SQ}" fill="#fff"/>`];
  const sx = x + 1, sy = y + 1;
  o.push(`<rect x="${f1(sx)}" y="${f1(sy)}" width="50" height="50" fill="none" stroke="#000" stroke-width="0.5"/>`);
  const c = sx + 25;
  o.push(text(c, sy + 10, 'この四角が', 4.2, { anchor: 'middle', fill: '#111' }));
  o.push(text(c, sy + 17, 'たて・よこ', 4.2, { anchor: 'middle', fill: '#111' }));
  o.push(text(c, sy + 28, '5cm', 9, { anchor: 'middle', weight: 'bold' }));
  o.push(text(c, sy + 37, 'なら、正しい', 4.2, { anchor: 'middle', fill: '#111' }));
  o.push(text(c, sy + 44, '大きさです', 4.2, { anchor: 'middle', fill: '#111' }));
  return o.join('');
}

// 紙の余白: 左右 10mm、上 12mm(ページ番号)、下 12mm(貼り方の案内 1行)
const MT = 12, MB = 12;
function tileFor(paper) {
  const [W, H] = PAPERS[paper] || PAPERS.A4;
  const tw = W - MARGIN * 2, th = H - MT - MB;
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

// 1枚目(A-1)の、型紙にも説明にも のりしろにもかからない所に 5cm の四角を置く。置けなければ null
function findSquareSpot(items, header, tile) {
  const polys = items.map((it) => it.geom.cut.map((p) => [p[0] + it.x, p[1] + it.y]));
  const free = (x, y) => {
    const R = { x: x - 3, y: y - 3, w: SQ + 6, h: SQ + 6 };
    if (R.x < header.x + header.w && R.x + R.w > header.x && R.y < header.y + header.h && R.y + R.h > header.y) return false;
    for (const P of polys) if (polyHitsRect(P, R) || pointInPoly([x + SQ / 2, y + SQ / 2], P)) return false;
    return true;
  };
  for (let y = 0; y + SQ <= tile.sy - 2; y += 4) for (let x = 0; x + SQ <= tile.sx - 2; x += 4) if (free(x, y)) return { x, y };
  return null;
}

// 紙はいつも縦向き(ページ番号・説明・5cm の四角は ふつうに読める向き)。
// 型紙の並べ方は いくつか試す: (1) そのまま (2) 横長の紙のつもりで並べて、型紙ごと 90° 回す。ページが少ない方。
// 説明は小さな帯にして、5cm の四角は 1枚目のあいた所へ。あいた所がなければ 説明の右に入れる。
export function printPlan(bag, sizeKey, opts = {}) {
  const paper = PAPERS[opts.paper] ? opts.paper : 'A4';
  const pieces = getPieces(bag, sizeKey);
  const tile = tileFor(paper);
  // 横長のつもりで並べるときの ページ(回す前の向き)
  const tileL = { tw: tile.th, th: tile.tw, sx: tile.th - GLUE, sy: tile.tw - GLUE };
  const info = headerLines(bag, sizeKey, pieces);
  const preps = preparedFor(bag, sizeKey);
  const dims = preps.map((p) => bbox(p.cut));
  const minD = dims.length ? Math.max(...dims.map((b) => Math.min(b.w, b.h))) : 0;
  let best = null;
  const W0 = Math.min(tile.sx - 2, 186);
  const forms = [headerLayout(info, W0)];
  if (info.square && preps.length) forms.push(headerLayout(info, 130), headerLayout(info, W0, true));
  for (const hl of forms) {
    const hw = hl.w, hh = hl.h;
    const header = { x: 0, y: 0, w: hw, h: hh };
    const consider = (lay, how) => {
      const sheetH = Math.max(lay.sheetH, hh);
      let square = hl.sq ? null : info.square ? findSquareSpot(lay.items, header, tile) : null;
      if (info.square && !hl.sq && !square) return; // 四角の置き場がない
      const pu = pagesUsed(lay.items, header, tile, lay.sheetW, sheetH);
      const score = pu.count * 1e4 + pu.rows * pu.cols * 10 + (how === 'straight' ? 0 : 1) + (hl.side ? 2 : 0);
      if (!best || score < best.score) best = { score, how, lay, pu, sheetH, header, hl, square };
    };
    // (1) そのまま
    const c0 = Math.max(1, Math.ceil((Math.max(hw, minD) - GLUE) / tile.sx - 1e-9));
    for (let cols = c0; cols <= c0 + 4; cols++) {
      const width = cols * tile.sx + GLUE;
      const lay = layoutPieces(bag, sizeKey, {
        width, tile, reserved: [header],
        score: (items, res) => pagesUsed(items, header, tile, width, Math.max(res.H, hh)).count * 1e6 + res.H,
      });
      consider({ ...lay, sheetW: width }, 'straight');
      if (!preps.length) break;
    }
    if (!preps.length || hw > tileL.th) continue;
    // (2) 横長のつもりで並べて 90° 回す
    const cL0 = Math.max(1, Math.ceil((Math.max(hh, minD) - GLUE) / tileL.sx - 1e-9));
    const rL0 = Math.max(1, Math.ceil((Math.max(hw, minD) - GLUE) / tileL.sy - 1e-9));
    for (let cols = cL0; cols <= cL0 + 3; cols++) {
      const width = cols * tileL.sx + GLUE;
      // 右へ回す: 説明は 回したあと左上になるよう、左下にとっておく
      for (let rows = rL0; rows <= rL0 + 6; rows++) {
        const sheetHt = rows * tileL.sy + GLUE;
        const hdr = { x: 0, y: sheetHt - hw, w: hh, h: hw };
        const lay = layoutPieces(bag, sizeKey, {
          width, tile: tileL, reserved: [hdr],
          score: (items, res) => pagesUsed(items, hdr, tileL, width, Math.max(res.H, sheetHt)).count * 1e6 + res.H,
        });
        if (lay.sheetH > sheetHt + 1e-6) continue;
        const items = lay.items.map((it) => {
          const g = place(it.prep, it.rotate + 90);
          return { piece: it.piece, x: sheetHt - (it.y + it.h), y: it.x, rotate: (it.rotate + 90) % 360, w: g.w, h: g.h, geom: g, prep: it.prep };
        });
        consider({ sheetW: sheetHt, sheetH: width, items }, 'turned');
        break;
      }
      // 左へ回す: 説明は右上にとっておく
      const hdr2 = { x: width - hh, y: 0, w: hh, h: hw };
      const lay2 = layoutPieces(bag, sizeKey, {
        width, tile: tileL, reserved: [hdr2],
        score: (items, res) => pagesUsed(items, hdr2, tileL, width, Math.max(res.H, hw)).count * 1e6 + res.H,
      });
      const H2 = Math.max(lay2.sheetH, hw);
      const items2 = lay2.items.map((it) => {
        const g = place(it.prep, it.rotate + 270);
        return { piece: it.piece, x: it.y, y: width - (it.x + it.w), rotate: (it.rotate + 270) % 360, w: g.w, h: g.h, geom: g, prep: it.prep };
      });
      consider({ sheetW: H2, sheetH: width, items: items2 }, 'turned');
    }
  }
  return { ...best, tile, header: best.header, headerInfo: best.hl, paper, pieces, hasPattern: preps.length > 0 };
}

const ROW = (r) => (r < 26 ? String.fromCharCode(65 + r) : 'Z' + (r - 25));
export const pageLabel = (r, c) => `${ROW(r)}-${c + 1}`;

// 印刷する型紙があるか(型紙がなく、布に直接 線を引くだけの袋は false)
export function hasPattern(bag, sizeKey) { return preparedFor(bag, sizeKey).length > 0; }

export function printPages(bag, sizeKey, opts = {}) {
  const plan = printPlan(bag, sizeKey, opts);
  const { tile, pu, lay, header, paper } = plan;
  const [PW, PH] = PAPERS[paper];
  const seamText = seamTextFor(plan.pieces);
  const list = [];
  for (let r = 0; r < pu.rows; r++) for (let c = 0; c < pu.cols; c++) if (pu.used[r][c]) list.push([r, c]);
  const total = list.length;
  const has = (r, c) => r >= 0 && c >= 0 && r < pu.rows && c < pu.cols && pu.used[r][c];
  // 四角(文字など)が どれか1ページの のりしろ以外に収まるか
  const blocks = [header, ...(plan.square ? [{ ...plan.square, w: SQ, h: SQ }] : [])];
  const fitsPage = (b) => {
    const c = Math.floor(b.x / tile.sx), r = Math.floor(b.y / tile.sy);
    const g = GLUE + 1; // 左・上の のりしろ(となりと重なる所)もさける
    if (!(b.x >= c * tile.sx + g * (c > 0 ? 1 : 0) + 0.5 && b.x + b.w <= (c + 1) * tile.sx - 1 && b.y >= r * tile.sy + g * (r > 0 ? 1 : 0) + 0.5 && b.y + b.h <= (r + 1) * tile.sy - 1)) return false;
    return !blocks.some((q) => b.x < q.x + q.w + 1 && b.x + b.w > q.x - 1 && b.y < q.y + q.h + 1 && b.y + b.h > q.y - 1);
  };
  const pieceLayer = lay.items.map((it) => ({ it, svg: pieceSVG(it.geom, it.x, it.y, { mode: 'print', u: 1, seamText, maxName: 12, minName: 4, fitsPage }) }));
  const id0 = `pp${++uid}`;
  const FS = 4.5; // ページの枠の字(mm)
  const pages = list.map(([r, c], k) => {
    const id = `${id0}-${k}`;
    const ox = c * tile.sx, oy = r * tile.sy;
    const R = { x: ox, y: oy, w: tile.tw, h: tile.th };
    const o = [];
    o.push(`<defs><clipPath id="${id}-c"><rect x="${MARGIN}" y="${MT}" width="${f1(tile.tw)}" height="${f1(tile.th)}"/></clipPath>`
      + `<pattern id="${id}-h" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="3" fill="#f2f2f2"/><path d="M0,0V3" stroke="#bdbdbd" stroke-width="0.6"/></pattern></defs>`);
    o.push(`<g clip-path="url(#${id}-c)"><g transform="translate(${f1(MARGIN - ox)} ${f1(MT - oy)})">`);
    // のりしろ(右・下に となりのページがあるとき)。寝かせる字は「のりしろ」だけ
    if (has(r, c + 1)) {
      o.push(`<rect x="${f1(ox + tile.sx)}" y="${f1(oy)}" width="${GLUE}" height="${f1(tile.th)}" fill="url(#${id}-h)"/>`);
      for (const f of [0.15, 0.5, 0.85]) o.push(text(ox + tile.sx + GLUE / 2, oy + tile.th * f, 'のりしろ', 4, { anchor: 'middle', baseline: 'central', rot: 90, fill: '#444', halo: true }));
    }
    if (has(r + 1, c)) {
      o.push(`<rect x="${f1(ox)}" y="${f1(oy + tile.sy)}" width="${f1(tile.tw)}" height="${GLUE}" fill="url(#${id}-h)"/>`);
      for (const f of [0.15, 0.5, 0.85]) o.push(text(ox + tile.tw * f, oy + tile.sy + GLUE / 2, 'のりしろ', 4, { anchor: 'middle', baseline: 'central', fill: '#444', halo: true }));
    }
    // パーツ
    for (const { it, svg } of pieceLayer) {
      if (it.x > R.x + R.w || it.x + it.w < R.x || it.y > R.y + R.h || it.y + it.h < R.y) continue;
      o.push(svg);
    }
    if (r === 0 && c === 0) {
      o.push(headerSVG(bag, sizeKey, plan.headerInfo, header.w, header.h));
      if (plan.square) o.push(squareSVG(plan.square.x, plan.square.y));
    }
    // 合わせ印 ◆(重なるところのまん中)
    const dia = (x, y) => `<path d="M${f1(x)},${f1(y - 3.5)}L${f1(x + 3.5)},${f1(y)}L${f1(x)},${f1(y + 3.5)}L${f1(x - 3.5)},${f1(y)}Z" fill="#111"/>`;
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
    o.push(`<rect x="${MARGIN}" y="${MT}" width="${f1(tile.tw)}" height="${f1(tile.th)}" fill="none" stroke="#999" stroke-width="0.25"/>`);
    // 切るところ(左・上にとなりがあるとき)
    const notes = [];
    const left = has(r, c - 1), up = has(r - 1, c);
    if (left) {
      o.push(`<path d="M${MARGIN},${MT}V${f1(MT + tile.th)}" stroke="#000" stroke-width="0.6" stroke-dasharray="2.5 1.5"/>`);
      o.push(text(MARGIN / 2, MT + tile.th / 2, '✂', 6, { anchor: 'middle', baseline: 'central', rot: -90 }));
    }
    if (up) {
      o.push(`<path d="M${MARGIN},${MT}H${f1(MARGIN + tile.tw)}" stroke="#000" stroke-width="0.6" stroke-dasharray="2.5 1.5"/>`);
    }
    if (left || up) {
      const side = left && up ? '左と上' : left ? '左' : '上';
      const to = [left && pageLabel(r, c - 1), up && pageLabel(r - 1, c)].filter(Boolean).join('と');
      notes.push(`✂ ${side}の白いふちを点線で切り、${to}のななめの線に重ねて◆を合わせて貼る`);
    } else {
      notes.push(total > 1 ? '1枚目です(切りません)。ほかの紙は、ふちを切って、この上に重ねて貼ります。' : 'この1枚で型紙ができます。');
    }
    // 上の余白: ページ番号・全体の中のどこか
    const fit = (s, size, w) => Math.min(size, w / Math.max(1, textW(s)));
    o.push(text(MARGIN, MT - 2.3, pageLabel(r, c), 8, { weight: 'bold' }));
    const cs = Math.min(8 / pu.rows, 40 / pu.cols, 5);
    const mapW = cs * pu.cols;
    const mx = MARGIN + tile.tw - mapW, my = MT - 2 - cs * pu.rows;
    const info = `${k + 1}枚目(全${total}枚) ${bag.name} ${sizeLabel(sizeKey)}`;
    const infoW = tile.tw - 22 - mapW - 16;
    o.push(text(MARGIN + 21, MT - 3, info, fit(info, FS, infoW), { fill: '#111' }));
    o.push(text(mx - 1.5, MT - 3, '貼る図', 4, { anchor: 'end', fill: '#111' }));
    for (let rr = 0; rr < pu.rows; rr++) for (let cc = 0; cc < pu.cols; cc++) {
      if (!pu.used[rr][cc]) continue;
      const me = rr === r && cc === c;
      o.push(`<rect x="${f1(mx + cc * cs)}" y="${f1(my + rr * cs)}" width="${f1(cs)}" height="${f1(cs)}" fill="${me ? '#222' : '#fff'}" stroke="#222" stroke-width="0.3"/>`);
    }
    // 下の余白: 貼り方(2行)
    for (const n of notes.slice(0, 1)) o.push(text(MARGIN, tile.H - MB + 6.5, n, Math.max(4, fit(n, FS, tile.tw)), { fill: '#111' }));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="${esc(FONT)}" data-page="${pageLabel(r, c)}"><rect width="${PW}" height="${PH}" fill="#fff"/>${o.join('')}</svg>`;
  });
  return {
    pages, cols: pu.cols, rows: pu.rows, paper,
    orientation: 'portrait',            // 紙はいつも縦向き
    turned: plan.how === 'turned',      // true = 型紙を 90° 回して並べた
    hasPattern: plan.hasPattern,        // false = 印刷する型紙がない(布に直接 線を引く袋。5cm の四角も出ない)
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
      // 半分の切る線(辺ごとの縫い代どおり)を、わ の線で ひらいた大きさ
      const b = bbox(cutOutline(pc));
      w = b.w; h = b.h;
      if (pc.fold) {
        const ob = bbox(pc.outline);
        if (pc.fold === 'left') w = 2 * (b.maxX - ob.minX);
        else if (pc.fold === 'right') w = 2 * (ob.maxX - b.minX);
        else if (pc.fold === 'top') h = 2 * (b.maxY - ob.minY);
        else if (pc.fold === 'bottom') h = 2 * (ob.maxY - b.minY);
      }
    }
    for (const c of cutsOf(pc)) {
      (by[c.fabric] ||= { rects: [], parts: [] });
      for (let i = 0; i < c.cut; i++) by[c.fabric].rects.push({ key: by[c.fabric].rects.length, w, h, rot: !!pc.measureOnly }); // 布目を守るため 型紙は回さない(ひもは回してよい)
      by[c.fabric].parts.push(`${pc.name} ${c.cut}${pc.unit || (pc.measureOnly ? '本' : '枚')}`);
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
    if (small && small.w <= 600 && small.h <= 600) note += `(${Math.ceil(small.w / 10)}×${Math.ceil(small.h / 10)}cmの、はぎれでも足ります)`;
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

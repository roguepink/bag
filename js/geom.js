// geom.js — 型紙の形を作る道具(型紙係)
// 単位は mm。y は下向き(SVG と同じ)。多角形は [[x,y],…](閉じた形・最後の点は最初と別)。
// 向き: 面積(area)がプラス = 画面で時計まわり。offset などは どちら向きでも動く。

const EPS = 1e-7;

// ---------- 基本の形 ----------
export function rect(w, h, x = 0, y = 0) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

// 角の数だけ点を足す細かさ(1点あたりの角度)
const STEP_DEG = 6;

// 円弧。角度は度。0 = 右、90 = 下(y 下向きなので時計まわり)。
// n を省くと 6° ごと。始点・終点を含む。
export function arc(cx, cy, r, a0, a1, n) {
  const span = a1 - a0;
  n = n ?? Math.max(2, Math.ceil(Math.abs(span) / STEP_DEG));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + (span * i) / n) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// 円(多角形)。右の点から時計まわり。
export function circle(cx, cy, r, n = 96) {
  const pts = arc(cx, cy, r, 0, 360, n);
  pts.pop();
  return pts;
}

export function ellipse(cx, cy, rx, ry, n = 96) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

// 角の丸い四角。r は数 or [左上, 右上, 右下, 左下]。左上から時計まわり。
export function roundRect(w, h, r = 0, x = 0, y = 0) {
  const rr = Array.isArray(r) ? r : [r, r, r, r];
  const lim = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = rr.map((v) => Math.max(0, Math.min(v || 0, lim)));
  const out = [];
  const corner = (cx, cy, rad, a0) => {
    if (rad <= 0) { out.push([cx, cy]); return; }
    out.push(...arc(cx, cy, rad, a0, a0 + 90));
  };
  // 左上
  if (tl > 0) corner(x + tl, y + tl, tl, 180); else out.push([x, y]);
  if (tr > 0) corner(x + w - tr, y + tr, tr, 270); else out.push([x + w, y]);
  if (br > 0) corner(x + w - br, y + h - br, br, 0); else out.push([x + w, y + h]);
  if (bl > 0) corner(x + bl, y + h - bl, bl, 90); else out.push([x, y + h]);
  return dedupe(out, true);
}

// 2次ベジェ(p0 → p2、p1 がひっぱる点)
export function quad(p0, p1, p2, n = 16) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

// 3次ベジェ
export function cubic(p0, p1, p2, p3, n = 20) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

// 何次でも(点の列 [p0,…,pn])。de Casteljau。
export function bezier(ctrl, n = 20) {
  if (ctrl.length === 3) return quad(ctrl[0], ctrl[1], ctrl[2], n);
  if (ctrl.length === 4) return cubic(ctrl[0], ctrl[1], ctrl[2], ctrl[3], n);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let q = ctrl.map((p) => [p[0], p[1]]);
    while (q.length > 1) {
      const nq = [];
      for (let k = 0; k < q.length - 1; k++) nq.push([q[k][0] + (q[k + 1][0] - q[k][0]) * t, q[k][1] + (q[k + 1][1] - q[k][1]) * t]);
      q = nq;
    }
    out.push(q[0]);
  }
  return out;
}

// 線をつなぐ(つなぎ目の同じ点は1つに)。最後が最初と同じなら消す。
export function join(...parts) {
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    const list = typeof part[0] === 'number' ? [part] : part;
    for (const p of list) out.push([p[0], p[1]]);
  }
  return dedupe(out, true);
}

// 続けて同じ点を消す(closed なら 最後と最初も)
export function dedupe(pts, closed = true, eps = 1e-6) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push([p[0], p[1]]);
  }
  if (closed && out.length > 1) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps) out.pop();
  }
  return out;
}

// ---------- はかる ----------
export function area(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

// 画面で時計まわり(面積プラス)にそろえる
export function orient(pts) {
  return area(pts) < 0 ? pts.slice().reverse() : pts.slice();
}

export function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (y < minY) minY = y;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  if (!pts.length) minX = minY = maxX = maxY = 0;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

// 線の長さ。closed = true なら一周。
export function length(pts, closed = false) {
  let s = 0;
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  if (closed && n > 1) s += Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]);
  return s;
}

export function perimeter(pts) { return length(pts, true); }

// 多角形の 点 i0 から 点 i1 までの線(前へ進む・一周して戻ってもよい)。両はしを含む。
export function sub(outline, i0, i1) {
  const n = outline.length;
  const out = [];
  let i = ((i0 % n) + n) % n;
  const end = ((i1 % n) + n) % n;
  out.push(outline[i]);
  let guard = 0;
  while (i !== end && guard++ <= n) { i = (i + 1) % n; out.push(outline[i]); }
  return out;
}

// 辺の長さ(点 i0 → i1)
export function edgeLength(outline, i0, i1) { return length(sub(outline, i0, i1)); }

export function centroid(pts) {
  const a = area(pts);
  if (Math.abs(a) < EPS) { const b = bbox(pts); return [b.x + b.w / 2, b.y + b.h / 2]; }
  let cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const f = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

// ---------- 動かす ----------
export function translate(pts, dx, dy) { return pts.map(([x, y]) => [x + dx, y + dy]); }
export function scale(pts, sx, sy = sx, cx = 0, cy = 0) { return pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]); }
export function rotate(pts, deg, cx = 0, cy = 0) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => { const dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; });
}

// 点を線(x = v / y = v)で折り返す
export function flip(pts, axis, v) {
  return axis === 'x' ? pts.map(([x, y]) => [2 * v - x, y]) : pts.map(([x, y]) => [x, 2 * v - y]);
}

// その辺が「わ」の線の上にあるか(辺ごとの true/false)
export function foldEdges(outline, side) {
  const n = outline.length;
  const flags = new Array(n).fill(false);
  if (!side) return flags;
  const b = bbox(outline);
  const axis = side === 'left' || side === 'right' ? 'x' : 'y';
  const v = side === 'left' ? b.minX : side === 'right' ? b.maxX : side === 'top' ? b.minY : b.maxY;
  const k = axis === 'x' ? 0 : 1;
  const tol = 0.05;
  for (let i = 0; i < n; i++) {
    const a = outline[i], c = outline[(i + 1) % n];
    flags[i] = Math.abs(a[k] - v) < tol && Math.abs(c[k] - v) < tol;
  }
  return flags;
}

// 「わ」の型紙(半分)から、ひらいた全体の形を作る
export function mirror(outline, side) {
  if (!side) return outline.slice();
  const pts = orient(dedupe(outline, true));
  const n = pts.length;
  const flags = foldEdges(pts, side);
  if (!flags.some(Boolean)) return pts;
  const b = bbox(pts);
  const axis = side === 'left' || side === 'right' ? 'x' : 'y';
  const v = side === 'left' ? b.minX : side === 'right' ? b.maxX : side === 'top' ? b.minY : b.maxY;
  // わ の辺の並び(a → … → b)を探す。b から a まで(わ でない側)を P とする。
  let start = -1;
  for (let i = 0; i < n; i++) if (flags[i] && !flags[(i - 1 + n) % n]) { start = i; break; }
  if (start < 0) return pts; // 全部がわ? ありえない
  let end = start;
  while (flags[end % n]) end++;
  const aIdx = start, bIdx = end % n; // 辺 start..end-1 が わ。点 bIdx から 点 aIdx へ回る
  const P = sub(pts, bIdx, aIdx);
  const M = flip(P, axis, v).reverse(); // a … b(鏡)
  return dedupe([...P, ...M.slice(1, M.length - 1)], true);
}

// ---------- 縫い代(切る線) ----------
// seam: 数 or 辺ごとの配列(辺 i = 点 i → 点 i+1)。0 の辺(わ など)はそのまま。
// 角: 外向きの角は とがらせる(縫い代の角)。とがりすぎるときは切り落とす(miterLimit × 縫い代)。
//     内向きの角は 交わる点。曲線(細かい辺)はなめらかにつながる。
export function offset(outline, seam = 10, opt = {}) {
  const miterLimit = opt.miterLimit ?? 2.2;
  // 長さ 0 の辺を除く(縫い代の配列もいっしょに)
  const src = [], srcSeam = [];
  const n0 = outline.length;
  for (let i = 0; i < n0; i++) {
    const a = outline[i], b = outline[(i + 1) % n0];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) continue;
    src.push(a);
    srcSeam.push(Array.isArray(seam) ? (seam[i] ?? seam[seam.length - 1] ?? 0) : seam);
  }
  const n = src.length;
  if (n < 3) return src.map((p) => [p[0], p[1]]);
  const sgn = area(src) >= 0 ? 1 : -1;
  const D = [], N = [];
  for (let i = 0; i < n; i++) {
    const a = src[i], b = src[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    D.push(d);
    N.push([d[1] * sgn, -d[0] * sgn]); // 外向き
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const ip = (i - 1 + n) % n;
    const P = src[i];
    const s0 = srcSeam[ip], s1 = srcSeam[i];
    const d0 = D[ip], d1 = D[i], n0v = N[ip], n1v = N[i];
    const A = [P[0] + n0v[0] * s0, P[1] + n0v[1] * s0]; // 前の辺の線上
    const B = [P[0] + n1v[0] * s1, P[1] + n1v[1] * s1]; // 次の辺の線上
    const cross = d0[0] * d1[1] - d0[1] * d1[0];
    const dot = d0[0] * d1[0] + d0[1] * d1[1];
    if (Math.abs(cross) < 1e-9) {
      if (dot > 0) {
        if (Math.abs(s0 - s1) < 1e-9) out.push(A);
        else out.push(A, B); // 同じ向きで縫い代が変わる → 段をつける
      } else {
        out.push(A, B); // 折り返し(とげ)
      }
      continue;
    }
    // 2本の線の交わり: A + d0 t = B + d1 u
    const t = ((B[0] - A[0]) * d1[1] - (B[1] - A[1]) * d1[0]) / cross;
    const X = [A[0] + d0[0] * t, A[1] + d0[1] * t];
    const convex = cross * sgn > 0;
    if (convex) {
      const lim = miterLimit * Math.max(s0, s1, 1);
      const dist = Math.hypot(X[0] - P[0], X[1] - P[1]);
      if (dist > lim + 1e-9) {
        // とがりすぎ → 先を切る
        const ta = Math.min(t, lim);
        const u = ((A[0] - B[0]) * d0[1] - (A[1] - B[1]) * d0[0]) / -cross; // B 側の進み
        const ub = Math.max(u, -lim);
        out.push([A[0] + d0[0] * ta, A[1] + d0[1] * ta], [B[0] + d1[0] * ub, B[1] + d1[1] * ub]);
      } else out.push(X);
    } else {
      out.push(X);
    }
  }
  return cleanLoops(dedupe(out, true, 1e-6), sgn);
}

// 縫い代の線が自分と交わってできた小さな輪(裏返った輪)を取りのぞく
export function cleanLoops(poly, sgn = 1) {
  let pts = poly.slice();
  let guard = 0;
  outer: while (guard++ < 200) {
    const n = pts.length;
    if (n < 4) return pts;
    for (let i = 0; i < n; i++) {
      const a1 = pts[i], a2 = pts[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // となり
        const b1 = pts[j], b2 = pts[(j + 1) % n];
        const X = segIntersect(a1, a2, b1, b2) || collinearTouch(a1, a2, b1, b2);
        if (!X) continue;
        const loop = [X, ...pts.slice(i + 1, j + 1)];
        const rest = [X, ...pts.slice(j + 1), ...pts.slice(0, i + 1)];
        const al = area(loop) * sgn, ar = area(rest) * sgn;
        // 正しい向きで大きい方を残す
        let keep;
        if (al > 0 && ar <= 0) keep = loop;
        else if (ar > 0 && al <= 0) keep = rest;
        else keep = Math.abs(al) >= Math.abs(ar) ? loop : rest;
        pts = dedupe(keep, true, 1e-6);
        continue outer;
      }
    }
    break;
  }
  return pts;
}

// 同じ直線の上で重なっている2本の線分 → 重なりの1点(なければ null)
function collinearTouch(a1, a2, b1, b2) {
  const dx = a2[0] - a1[0], dy = a2[1] - a1[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) return null;
  const off = (p) => Math.abs((p[0] - a1[0]) * dy - (p[1] - a1[1]) * dx) / L;
  if (off(b1) > 1e-6 || off(b2) > 1e-6) return null;
  const t = (p) => ((p[0] - a1[0]) * dx + (p[1] - a1[1]) * dy) / (L * L);
  const tb1 = t(b1), tb2 = t(b2);
  const lo = Math.max(0, Math.min(tb1, tb2)), hi = Math.min(1, Math.max(tb1, tb2));
  if (hi - lo < 1e-6) return null; // 点で触れるだけ
  return tb1 > 1e-6 && tb1 < 1 - 1e-6 ? [b1[0], b1[1]] : [a1[0] + dx * lo, a1[1] + dy * lo];
}

// 線分の交わり(はしは除く)。なければ null
export function segIntersect(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / den;
  const e = 1e-9;
  if (t <= e || t >= 1 - e || u <= e || u >= 1 - e) return null;
  return [p1[0] + d1x * t, p1[1] + d1y * t];
}

// ---------- しらべる ----------
export function pointInPoly(pt, poly) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 多角形と 四角(x,y,w,h)が重なるか
export function polyHitsRect(poly, r) {
  const b = bbox(poly);
  if (b.maxX < r.x || b.minX > r.x + r.w || b.maxY < r.y || b.minY > r.y + r.h) return false;
  for (const p of poly) if (p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h) return true;
  const rc = rect(r.w, r.h, r.x, r.y);
  for (const c of rc) if (pointInPoly(c, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    for (let k = 0; k < 4; k++) if (segIntersect(a, c, rc[k], rc[(k + 1) % 4])) return true;
  }
  return false;
}

// 点にいちばん近い辺 { index, dist, t, foot }
export function nearestEdge(outline, pt) {
  let best = null;
  for (let i = 0, n = outline.length; i < n; i++) {
    const a = outline[i], b = outline[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2));
    const f = [a[0] + dx * t, a[1] + dy * t];
    const d = Math.hypot(pt[0] - f[0], pt[1] - f[1]);
    if (!best || d < best.dist) best = { index: i, dist: d, t, foot: f };
  }
  return best;
}

// 外向きの向き(単位)。辺 i
export function edgeNormal(outline, i) {
  const n = outline.length;
  const a = outline[i], b = outline[(i + 1) % n];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const sgn = area(outline) >= 0 ? 1 : -1;
  return [((b[1] - a[1]) / L) * sgn, (-(b[0] - a[0]) / L) * sgn];
}

// 一周の上で、点 i0 から 長さ dist だけ進んだところの点
export function pointAlong(outline, i0, dist) {
  const n = outline.length;
  let i = i0, left = dist;
  for (let k = 0; k < n; k++) {
    const a = outline[i % n], b = outline[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= L) { const t = L ? left / L : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    left -= L; i++;
  }
  return outline[i0 % n];
}

// 数を見やすく(mm → cm の文字)
export function cm(mm, digits = 1) {
  const v = Math.round((mm / 10) * 10 ** digits) / 10 ** digits;
  return String(v);
}

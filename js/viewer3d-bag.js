// 3D係: Shape3D(mm)から、バッグの形を手続き的に作る。
// buildBag(shape, mats) => { group, stats }
// すべて mm 単位。y が上、+z が前(正面)、+x が右。
import * as THREE from 'three';

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const num = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? d : +v;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- 角丸の四角(横の切り口)
// s=0 が前のまん中(+z)、s が増えると右(+x)へ回る。s=0.25 右わき、0.5 うしろ、0.75 左わき。
function rrQ0(a, b, r, l, o) {
  const sx = a - r, sz = b - r, arc = PI * r / 2;
  if (l <= sx) { o.x = l; o.z = b; o.nx = 0; o.nz = 1; }
  else if (l <= sx + arc) {
    const th = r > 0 ? (l - sx) / r : 0;
    o.x = sx + r * Math.sin(th); o.z = sz + r * Math.cos(th); o.nx = Math.sin(th); o.nz = Math.cos(th);
  } else { o.x = a; o.z = Math.max(0, sz - (l - sx - arc)); o.nx = 1; o.nz = 0; }
}
function rrPoint(a, b, r, s, o) {
  a = Math.max(a, 0.5); b = Math.max(b, 0.5); r = clamp(r, 0, Math.min(a, b));
  const q = (a - r) + (b - r) + PI * r / 2;
  const f = s - Math.floor(s), L = f * 4 * q;
  const k = Math.min(3, Math.floor(L / q)), l = L - k * q;
  if (k === 0) rrQ0(a, b, r, l, o);
  else if (k === 1) { rrQ0(a, b, r, q - l, o); o.z = -o.z; o.nz = -o.nz; }
  else if (k === 2) { rrQ0(a, b, r, l, o); o.x = -o.x; o.z = -o.z; o.nx = -o.nx; o.nz = -o.nz; }
  else { rrQ0(a, b, r, q - l, o); o.x = -o.x; o.nx = -o.nx; }
  return o;
}

// ---------------------------------------------------------------- 本体(たての断面を積み重ねる)
class Body {
  constructor(cfg) { this.cfg = cfg; this._o = {}; }
  point(t, s, out = V()) {
    const c = this.cfg, pr = c.prof(clamp(t, 0, 1)), o = rrPoint(pr.a, pr.b, pr.r, s, this._o);
    let x = o.x, z = o.z;
    if (pr.wave) { const k = 1 + pr.wave * Math.sin(pr.waveN * TAU * s); x *= k; z *= k; }
    const cx = clamp(1 - (x / Math.max(pr.a, 1)) ** 2, 0, 1);
    if (c.dent) z *= 1 - c.dent * smooth(0.5, 1, t) * cx * 0.45;      // 口のまん中が少しへこむ
    if (c.bulge) z *= 1 + c.bulge * Math.sin(PI * t) * cx;             // 胴がやわらかくふくらむ
    let y = t * c.h;
    if (c.sag) y -= c.sag * t * t * t * cx;                            // 口の線が少したるむ
    return out.set(x, y, z);
  }
  normal(t, s, out = V()) {
    const e = 0.002, p0 = this.point(t, s - e), p1 = this.point(t, s + e);
    const q0 = this.point(t - e, s), q1 = this.point(t + e, s);
    const ds = p1.sub(p0), dt = q1.sub(q0);
    out.crossVectors(ds, dt);
    if (out.lengthSq() < 1e-10) out.set(Math.sin(TAU * s), 0, Math.cos(TAU * s));
    return out.normalize();
  }
  // 前(side=+1)/うしろ(side=-1)の面で、横位置 x にある点
  faceS(x, t, side = 1) {
    let lo = side > 0 ? -0.25 : 0.25, hi = side > 0 ? 0.25 : 0.75;
    const p = V();
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2; this.point(t, m, p);
      const inc = side > 0 ? p.x < x : p.x > x;
      if (inc) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  facePoint(x, t, side = 1, lift = 0) {
    const s = this.faceS(x, t, side), p = this.point(t, s), n = this.normal(t, s);
    return p.addScaledVector(n, lift);
  }
}

function bodyGeometry(body, N = 44, M = 96) {
  const c = body.cfg;
  const ts = []; for (let i = 0; i <= N; i++) ts.push(0.5 - 0.5 * Math.cos(PI * i / N));
  const pos = [], uv = [], col = [], P = [];
  const vPrev = new Array(M + 1).fill(0);
  for (let i = 0; i <= N; i++) {
    const row = [];
    for (let j = 0; j <= M; j++) row.push(body.point(ts[i], 0.5 + j / M));  // つなぎ目はうしろのまん中
    let arc = 0; const us = [0];
    for (let j = 1; j <= M; j++) { arc += row[j].distanceTo(row[j - 1]); us.push(arc); }
    for (let j = 0; j <= M; j++) {
      if (i > 0) vPrev[j] += row[j].distanceTo(P[i - 1][j]);
      const p = row[j]; pos.push(p.x, p.y, p.z);
      uv.push(us[j] - arc / 2, vPrev[j]);
      const ao = 0.8 + 0.2 * smooth(0, 70, p.y);
      col.push(ao, ao, ao);
    }
    P.push(row);
  }
  const idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + 1, d = a + M + 1, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal;   // つなぎ目の法線をそろえる
  for (let i = 0; i <= N; i++) {
    const a = i * (M + 1), b = a + M;
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l);
  }
  // 裏布用: 奥ほど暗い
  const lining = g.clone();
  const lc = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) {
    const k = 0.38 + 0.62 * Math.pow(ts[i], 1.4); lc.push(k, k, k);
  }
  lining.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
  return { outer: g, lining, rows: P, ts };
}

function capGeometry(ring, up, dark = 1) {
  // ring: Vector3[](最後は最初と同じ点)。up=true なら上向きのふた
  const n = ring.length - 1, c = V();
  for (let i = 0; i < n; i++) c.add(ring[i]); c.divideScalar(n);
  const pos = [c.x, c.y, c.z], uv = [c.x, c.z], col = [dark, dark, dark], idx = [];
  for (let i = 0; i <= n; i++) { const p = ring[i]; pos.push(p.x, p.y, p.z); uv.push(p.x, p.z); col.push(dark, dark, dark); }
  for (let i = 1; i <= n; i++) up ? idx.push(0, i, i + 1) : idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- 格子の面(フラップ・ポケット)
function gridGeometry(nu, nv, fn, outward) {
  const pos = [], uv = [], col = [], p = V(), t = new THREE.Vector2();
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    fn(i / nu, j / nv, p, t); pos.push(p.x, p.y, p.z); uv.push(t.x, t.y); col.push(1, 1, 1);
  }
  const idx = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, d = a + nv + 1, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  if (outward) {   // 表がどちらを向くかそろえる
    const k = Math.floor(nu / 2) * (nv + 1) + Math.floor(nv / 2), n = g.attributes.normal;
    if (n.getX(k) * outward.x + n.getY(k) * outward.y + n.getZ(k) * outward.z < 0) {
      for (let i = 0; i < idx.length; i += 3) { const s = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = s; }
      g.setIndex(idx); g.computeVertexNormals();
    }
  }
  return g;
}

// ---------------------------------------------------------------- 持ち手(平たいテープ)
// opts: width(num|fn u), thick(num|fn u), hint(Vector3), mode 'face'(面の向き)|'width'(幅の向き)
function strapGeometry(points, opts) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const len = curve.getLength(), n = clamp(Math.round(len / 7), 24, 220);
  const W = typeof opts.width === 'function' ? opts.width : () => opts.width;
  const T = typeof opts.thick === 'function' ? opts.thick : () => opts.thick;
  const hint = opts.hint || V(0, 0, 1), mode = opts.mode || 'face';
  const pos = [], nor = [], uv = [], idx = [], edges = [[], [], [], []];
  const p = V(), tg = V(), wd = V(), nm = V(), c = [V(), V(), V(), V()];
  let prevN = null;
  for (let i = 0; i <= n; i++) {
    const u = i / n; curve.getPointAt(u, p); curve.getTangentAt(u, tg);
    const h = typeof hint === 'function' ? hint(u, p) : hint;
    if (mode === 'face') { wd.crossVectors(tg, h); if (wd.lengthSq() < 1e-8) wd.set(1, 0, 0); wd.normalize(); nm.crossVectors(wd, tg).normalize(); }
    else { wd.copy(h).addScaledVector(tg, -h.dot(tg)); if (wd.lengthSq() < 1e-8) wd.set(0, 0, 1); wd.normalize(); nm.crossVectors(tg, wd).normalize(); }
    if (prevN && nm.dot(prevN) < 0) { nm.negate(); wd.negate(); }
    prevN = nm.clone();
    const w = W(u) / 2, t = T(u) / 2, L = u * len;
    c[0].copy(p).addScaledVector(wd, w).addScaledVector(nm, t);
    c[1].copy(p).addScaledVector(wd, -w).addScaledVector(nm, t);
    c[2].copy(p).addScaledVector(wd, -w).addScaledVector(nm, -t);
    c[3].copy(p).addScaledVector(wd, w).addScaledVector(nm, -t);
    const fn = [nm, wd.clone().negate(), nm.clone().negate(), wd];
    for (let f = 0; f < 4; f++) {
      const A = c[f], B = c[(f + 1) % 4], N = fn[f];
      pos.push(A.x, A.y, A.z, B.x, B.y, B.z); nor.push(N.x, N.y, N.z, N.x, N.y, N.z);
      const across = f % 2 ? t * 2 : w * 2;
      uv.push(L, 0, L, across);
    }
    const ins = Math.min(3, w * 0.35);  // ステッチは端から 3mm
    edges[0].push(p.clone().addScaledVector(wd, w - ins).addScaledVector(nm, t + 0.4));
    edges[1].push(p.clone().addScaledVector(wd, -w + ins).addScaledVector(nm, t + 0.4));
    edges[2].push(p.clone().addScaledVector(wd, w - ins).addScaledVector(nm, -t - 0.4));
    edges[3].push(p.clone().addScaledVector(wd, -w + ins).addScaledVector(nm, -t - 0.4));
  }
  for (let i = 0; i < n; i++) for (let f = 0; f < 4; f++) {
    const a = i * 8 + f * 2, b = a + 1, d = a + 8, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  // 両はしのふた
  for (const [i, sgn] of [[0, -1], [n, 1]]) {
    const base = pos.length / 3; curve.getTangentAt(i / n, tg); tg.multiplyScalar(sgn);
    for (let f = 0; f < 4; f++) {
      const k = (i * 8 + f * 2) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); nor.push(tg.x, tg.y, tg.z); uv.push(0, 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return { geo: g, edges, curve, len };
}

// 半だ円の長さ(ラマヌジャンの式)
const halfEllipse = (a, b) => PI / 2 * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
function riseFor(span, L) {     // 半分の幅 span で、弧の長さ L になる高さ
  if (L <= halfEllipse(span, 1)) return Math.max(10, span * 0.3);
  let lo = 1, hi = 5000;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; halfEllipse(span, m) < L ? lo = m : hi = m; }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------- 形の仲間ごとの設定
const FAMILIES = ['flat', 'boxed', 'gusset', 'cylinder', 'halfmoon', 'trapezoid', 'backpack', 'round', 'envelope', 'gathered', 'knot', 'azuma'];

function familyConfig(S) {
  let fam = FAMILIES.includes(S.family) ? S.family : 'boxed';
  const w = clamp(num(S.w, 300), 40, 2000), h = clamp(num(S.h, 300), 40, 2000), d = clamp(num(S.d, 0), 0, 1500);
  const W = w / 2, hs = Array.isArray(S.handles) ? S.handles.filter(Boolean) : [];
  let closure = S.closure || null;
  const knapsack = fam === 'backpack' && hs.some(x => x.type === 'cord') && !hs.some(x => x.type === 'backpack');
  if (knapsack && !closure) closure = 'drawstring';
  const cfg = { fam, w, h, d, W, closure, knapsack, dent: 0.35, sag: h * 0.012, bulge: 0.04, closedTop: false,
    sideSeams: [0.25, 0.75], bottomEdge: false, topStitch: true,
    zipStyle: S.zip === 'around' || S.zip === 'top' ? S.zip : (fam === 'backpack' ? 'around' : 'top') };
  let D, r;
  switch (fam) {
    case 'flat': {
      const D0 = d / 2, bul = 0.05 * w + D0;
      cfg.prof = t => {
        const b = 3 + bul * Math.pow(Math.sin(PI * (0.06 + 0.84 * t)), 0.7) * Math.sqrt(smooth(0, 0.12, t) * 0.9 + 0.1);
        return { a: W - 0.2 * (b - 3), b, r: b };
      };
      cfg.bulge = 0; cfg.dent = 0.25; break;
    }
    case 'gusset': {
      D = Math.max(d / 2, 40);
      const R = clamp(num(S.corner, Math.min(h * 0.42, W * 0.5)), 10, Math.min(h * 0.5, W * 0.9)), rb = Math.min(28, R);
      cfg.prof = t => {
        const y = t * h; let a = W, k = 1;
        if (y > h - R) { const q = (y - (h - R)) / R; a = W - R + R * Math.sqrt(Math.max(0, 1 - q * q)); k = 1 - 0.3 * (1 - Math.sqrt(Math.max(0, 1 - q * q))); }
        if (y < rb) { const q = (rb - y) / rb; a = Math.min(a, W - rb + rb * Math.sqrt(Math.max(0, 1 - q * q))); }
        const b = D * k * (1 + 0.04 * Math.sin(PI * t));
        return { a, b, r: b * 0.75 };
      };
      cfg.closedTop = true; if (!closure) cfg.closure = 'zip'; cfg.bottomEdge = true; break;
    }
    case 'cylinder': {
      const A = W, B = d > 0 ? d / 2 : W;
      cfg.prof = t => ({ a: A, b: B, r: Math.min(A, B) });
      cfg.sideSeams = [0.5]; cfg.bottomEdge = true; cfg.dent = 0.2; break;
    }
    case 'halfmoon': {
      D = Math.max(d / 2, w * 0.09);
      cfg.prof = t => { const f = Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)); const b = D * (0.25 + 0.75 * f); return { a: Math.max(W * f, b + 2), b, r: b }; };
      cfg.closedTop = closure === 'zip' || closure === 'frame' || closure === 'snap'; cfg.bulge = 0.08; break;
    }
    case 'trapezoid': {
      D = Math.max(d / 2, 25); const Wt = num(S.topW, w * 1.35) / 2; r = clamp(num(S.corner, 10), 2, D);
      cfg.prof = t => ({ a: lerp(W, Wt, t), b: D * (1 + 0.05 * Math.sin(PI * t)), r });
      cfg.bottomEdge = true; break;
    }
    case 'backpack': {
      D = Math.max(d / 2, 50);
      const sack = closure === 'drawstring', hasFlap = !!S.flap;
      const R = sack ? Math.min(W * 0.25, h * 0.1) : hasFlap ? Math.min(W * 0.55, h * 0.22) : Math.min(W * 0.95, h * 0.42);
      const rb = Math.min(W * 0.35, h * 0.14, 45);
      r = clamp(num(S.corner, D * 0.85), 8, D);
      cfg.prof = t => {
        const y = t * h; let a = W, b = D;
        if (y > h - R) { const q = (y - (h - R)) / R, f = Math.sqrt(Math.max(0, 1 - q * q)); a = W - R + R * f; b = D * (0.6 + 0.4 * f); }
        if (y < rb) { const q = (rb - y) / rb, f = Math.sqrt(Math.max(0, 1 - q * q)); a = Math.min(a, W - rb + rb * f); b = Math.min(b, D * (0.8 + 0.2 * f)); }
        b *= 1 + 0.05 * Math.sin(PI * t);
        return { a, b, r: Math.min(r, b, a) };
      };
      cfg.bulge = 0.1; cfg.closedTop = !sack; if (!closure && !hasFlap) cfg.closure = 'zip'; cfg.bottomEdge = !sack; break;
    }
    case 'round': {
      D = Math.max(d / 2, w * 0.17); const Wt = num(S.topW, w * 0.72) / 2;
      const topB = closure === 'frame' ? D * 0.2 : D * 0.45;
      cfg.prof = t => {
        let a, b;
        if (t < 0.5) { const q = t / 0.5, f = Math.sqrt(Math.max(0, 1 - (1 - q) ** 2)); a = W * (0.4 + 0.6 * f); b = D * (0.45 + 0.55 * f); }
        else { const k = smooth(0.5, 1, t); a = lerp(W, Wt, k); b = lerp(D, topB, k); }
        return { a, b, r: b };
      };
      cfg.closedTop = true; if (!closure) cfg.closure = 'frame'; cfg.sideSeams = [0.25, 0.75]; cfg.bulge = 0.05; break;
    }
    case 'envelope': {
      D = Math.max(d / 2, 9);
      cfg.prof = t => ({ a: W * (1 - 0.01 * Math.sin(PI * t)), b: D * (0.8 + 0.4 * Math.sin(PI * t)), r: Math.min(D, 6) });
      cfg.closedTop = true; cfg.bulge = 0; cfg.bottomEdge = true;
      if (!S.flap) cfg.flap = { h: h * 0.5, shape: 'point' };
      break;
    }
    case 'gathered': {
      D = Math.max(d / 2, W * 0.42); const Wt = num(S.topW, w * 0.6) / 2;
      const band = S.band != null && num(S.band, 0) > 0 ? clamp(num(S.band, 40), 10, h * 0.4) : clamp(h * 0.14, 25, 60), yb = h - band, Dt = Math.min(D * 0.55, Wt * 0.5);
      cfg.prof = t => {
        const y = t * h;
        if (y >= yb) return { a: Wt * 1.02, b: Dt, r: Dt * 0.9 };
        const q = y / yb, s = Math.sin(PI * Math.min(1, q * 0.8 + 0.12));
        let a = W * (0.7 + 0.3 * s), b = D * (0.7 + 0.3 * s);
        const g = smooth(0.62, 1, q); a = lerp(a, Wt, g); b = lerp(b, Dt, g);
        return { a, b, r: b * 0.9, wave: 0.075 * smooth(0.4, 0.98, q), waveN: 13 };
      };
      cfg.dent = 0.1; cfg.sag = 0; cfg.gatherBand = band; cfg.bulge = 0; break;
    }
    case 'knot': {
      D = Math.max(d / 2, 18); const rb = clamp(num(S.corner, Math.min(W * 0.45, h * 0.35)), 5, Math.min(W, h * 0.5));
      cfg.prof = t => {
        const y = t * h; let a = W * (0.93 + 0.07 * t);
        if (y < rb) { const q = (rb - y) / rb; a = Math.min(a, a - rb + rb * Math.sqrt(Math.max(0, 1 - q * q))); a = Math.max(a, D + 2); }
        return { a, b: D * (1 + 0.15 * Math.sin(PI * t)), r: D };
      };
      cfg.dent = 0.2; break;
    }
    case 'azuma': {
      D = Math.max(d / 2, w * 0.07);
      cfg.prof = t => ({ a: W * (0.97 + 0.03 * Math.sin(PI * t)), b: D * (0.6 + 0.6 * Math.sin(PI * Math.min(1, t * 0.9 + 0.05))), r: D * 0.8 });
      cfg.dent = 0.15; cfg.topStitch = false; cfg.bulge = 0; break;
    }
    default: { // boxed
      D = Math.max(d / 2, 15); r = clamp(num(S.corner, 12), 3, D);
      cfg.prof = t => ({ a: W * (1 + 0.012 * Math.sin(PI * t)), b: D, r });
      cfg.bottomEdge = true;
    }
  }
  if (cfg.closure === 'zip' || cfg.closure === 'frame') cfg.closedTop = fam !== 'gathered';
  if (cfg.closedTop) { cfg.dent = 0; cfg.sag = 0; cfg.topStitch = false; }

  if (S.bottom === 'round') {
    const base = cfg.prof, rb = Math.min(h * 0.25, W * 0.6);
    cfg.prof = t => {
      const p = base(t), y = t * h; if (y >= rb) return p;
      const q = (rb - y) / rb, f = 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - q * q));
      return { ...p, a: p.a * f, b: p.b * Math.max(f, 0.55), r: p.r * f };
    };
    cfg.bottomEdge = false;
  } else if (S.bottom === 'flat') {
    const tf = { halfmoon: 0.14, round: 0.14, gathered: 0.06, knot: 0.12 }[fam];
    if (tf) { const base = cfg.prof; cfg.prof = t => base(tf + t * (1 - tf)); cfg.bottomEdge = true; }
  }

  // 巾着: 口をしぼってギャザーにする
  if (cfg.closure === 'drawstring' && fam !== 'envelope') {
    const base = cfg.prof, ch = h - 35, g0 = h - 115;
    cfg.closedTop = false; cfg.dent = 0; cfg.sag = 0; cfg.topStitch = false; cfg.channelY = ch;
    cfg.prof = t => {
      const p = base(t), y = t * h;
      let k = 1, wave = p.wave || 0;
      if (y > g0 && y <= ch) { const q = smooth(g0, ch, y); k = lerp(1, 0.45, q); wave = Math.max(wave, 0.09 * q); }
      else if (y > ch) { const q = (y - ch) / (h - ch); k = lerp(0.45, 0.6, Math.sqrt(q)); wave = 0.12; }
      return { a: p.a * k, b: p.b * k, r: p.r * k, wave, waveN: 11 };
    };
  }
  return cfg;
}

// ---------------------------------------------------------------- 組み立て
export function buildBag(S, M) {
  S = S || {};
  const cfg = familyConfig(S), body = new Body(cfg), { h, w } = cfg;
  const group = new THREE.Group();
  const add = (geo, mat, opts = {}) => { const m = new THREE.Mesh(geo, mat); if (opts.order) m.renderOrder = opts.order; group.add(m); return m; };
  const line = (pts, dashed = true, mat) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, mat || (dashed ? M.stitch : M.seam));
    if (dashed) l.computeLineDistances();
    group.add(l); return l;
  };

  // 本体
  const bg = bodyGeometry(body, cfg.closure === 'drawstring' || cfg.fam === 'gathered' ? 60 : 44, 112);
  add(bg.outer, M.outer);
  if (!cfg.closedTop) add(bg.lining, M.lining);
  const ring0 = bg.rows[0], ringTop = bg.rows[bg.rows.length - 1];
  add(capGeometry(ring0, false, 0.75), M.outer);
  if (!cfg.closedTop) add(capGeometry(ring0, false, 0.3), M.liningCap);
  else add(capGeometry(ringTop, true, 1), M.outer);

  // 口のふち(布の厚み)
  const ringPts = (t, lift, n = 160) => { const a = []; for (let i = 0; i <= n; i++) { const s = 0.5 + i / n; a.push(body.point(t, s).addScaledVector(body.normal(t, s), lift)); } return a; };
  if (!cfg.closedTop) {
    const rc = new THREE.CatmullRomCurve3(ringPts(1, -0.8, 120).slice(0, -1), true);
    add(new THREE.TubeGeometry(rc, 200, 2.2, 6, true), M.rim);
  }
  // ステッチ・縫い目
  if (cfg.topStitch) line(ringPts(1 - 9 / h, 0.6));
  if (cfg.gatherBand) { line(ringPts(1 - (cfg.gatherBand - 4) / h, 0.6), false); line(ringPts(1 - 8 / h, 0.6)); }
  if (cfg.closedTop) line(ringPts(0.999, 0.4), false);
  if (cfg.bottomEdge) line(ringPts(0.004, 0.4), false);
  for (const s of cfg.sideSeams) {
    const pts = []; const t0 = cfg.closedTop ? 0.0 : 0.0;
    for (let i = 0; i <= 50; i++) { const t = t0 + (1 - t0) * i / 50; pts.push(body.point(t, s).addScaledVector(body.normal(t, s), 0.5)); }
    line(pts, false);
  }

  const topA = cfg.prof(1).a, topB = cfg.prof(1).b;
  const S_ = { S, cfg, body, group, add, line, M, h, w, topA, topB };

  // フラップ
  const flap = S.flap || cfg.flap;
  let flapBottom = h;
  if (flap) flapBottom = buildFlap(S_, flap, S.closure);
  if (flap && cfg.fam === 'backpack') {
    const bx = Math.min(S_.topA * 0.45, w * 0.22);
    for (const sx of [-1, 1]) {
      const x = sx * bx, y0 = Math.min(h - 10, flapBottom + 45);
      const pts = [body.facePoint(x, y0 / h, 1, 5.5), body.facePoint(x, (flapBottom + 6) / h, 1, 5), body.facePoint(x, (flapBottom - 14) / h, 1, 2.5), body.facePoint(x, Math.max(0.08, (flapBottom - 70) / h), 1, 2)];
      strapMesh(S_, pts, { width: 20, thick: 2.4, hint: V(0, 0, 1), mode: 'face' }, M.strap);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(28, 14, 4), M.metal);
      bk.position.copy(body.facePoint(x, (flapBottom - 8) / h, 1, 4)); group.add(bk);
    }
  }
  // ポケット
  if (S.pocket) buildPocket(S_, S.pocket, flap ? flapBottom : h);
  // 口の閉じ方
  buildClosure(S_, cfg.closure, flap, flapBottom);
  // 持ち手
  const handles = Array.isArray(S.handles) ? S.handles : [];
  if (cfg.fam === 'azuma') buildAzuma(S_, handles);
  else if (cfg.fam === 'knot' || handles.some(x => x && x.type === 'knot')) buildKnot(S_, handles);
  for (const hd of handles) {
    if (!hd) continue;
    if (cfg.fam === 'azuma') continue;
    if (hd.type === 'knot') continue;
    if (cfg.fam === 'knot' && hd.type === 'loop') continue;
    buildHandle(S_, hd);
  }
  cfg.viewTheta = cfg.fam === 'backpack' ? -0.85 : -0.55;
  return { group, cfg };
}

// ---------------------------------------------------------------- フラップ(かぶせ)
function buildFlap(S_, flap, closure) {
  const { cfg, body, h, add, line, M } = S_;
  const fh = clamp(num(flap.h, h * 0.4), 15, h * 0.95), shape = flap.shape || 'square';
  const A0 = S_.topA + 1.5, Rr = Math.max(S_.topB, 4) + 2.5;
  const Amax = Math.max(A0, cfg.prof(clamp((h - fh) / h, 0, 1)).a + 1.5);
  const Aat = y => Math.max(A0, cfg.prof(clamp(y / h, 0, 1)).a + 1.5);   // その高さの本体の半分の幅
  const Lx = xn => {                     // xn: -1〜1(左はし〜右はし)
    xn = clamp(Math.abs(xn), 0, 1); const A = Amax;
    if (shape === 'point') return fh * (0.5 + 0.5 * (1 - xn) ** 1.1);
    if (shape === 'round') { const Re = Math.min(fh * 0.7, A * 0.9); return fh - Re + Re * Math.sqrt(Math.max(0, 1 - xn * xn)); }
    const c = Math.min(12, A * 0.2), ax = xn * A;
    if (ax > A - c) { const q = (ax - (A - c)) / c; return fh - c + c * Math.sqrt(Math.max(0, 1 - q * q)); }
    return fh;
  };
  const backDrop = 14, arc = PI * Rr;
  const place = (xn, l, p) => {          // l: うしろ(下がった所)から測った長さ
    if (l < backDrop) { const y = h - backDrop + l; p.copy(body.facePoint(xn * Aat(y), y / h, -1, 1.8)); return; }
    l -= backDrop;
    if (l < arc) {
      const th = l / Rr, e = Math.pow(Math.abs(xn), 6);
      p.set(xn * A0, h + 2.5 + Rr * Math.sin(th) * 0.3 * (1 - e) - 3 * e, -Rr * Math.cos(th)); return;
    }
    const y = h - (l - arc); p.copy(body.facePoint(xn * Aat(y), clamp(y / h, 0, 1), 1, 3));
  };
  const NU = 40, NV = 40, tmp = V();
  const geo = gridGeometry(NU, NV, (u, v, p, t) => {
    const xn = lerp(-1, 1, u), total = backDrop + arc + Lx(xn), l = v * total;
    place(xn, l, p); t.set(p.x, -l);
  }, V(0, 1, 0.3));
  add(geo, M.flapOuter); add(geo, M.flapLining);
  // ふちのステッチ
  const st = [];
  for (let i = 0; i <= 80; i++) {
    const xn = lerp(-0.94, 0.94, i / 80), total = backDrop + arc + Math.max(0, Lx(xn) - 7);
    place(xn, total, tmp); st.push(tmp.clone().add(V(0, 0, 0.8)));
  }
  line(st);
  // ふち(厚み)
  const edge = [];
  for (let i = 0; i <= 60; i++) { const xn = lerp(-1, 1, i / 60); place(xn, backDrop + arc + Lx(xn), tmp); edge.push(tmp.clone()); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, false, 'centripetal'), 120, 2.2, 6, false), M.rimDark);
  return h - Lx(0);
}

// ---------------------------------------------------------------- ポケット
function buildPocket(S_, pk, limitY) {
  const { cfg, body, h, w, add, line, M } = S_;
  const side = pk.side === 'back' ? -1 : 1;
  const ph = clamp(num(pk.h, h * 0.4), 25, h * 0.6);
  const yt = Math.min(h * 0.75, (side > 0 ? limitY : h) - 18), yb = Math.max(15, yt - ph);
  const aMin = Math.min(cfg.prof(clamp(yt / h, 0, 1)).a, cfg.prof(clamp(yb / h, 0, 1)).a);
  const pw = clamp(num(pk.w, w * 0.5), 30, Math.max(31, aMin * 1.6));
  const pt = (x, y, lift) => body.facePoint(x, clamp(y / h, 0, 1), side, lift);
  const geo = gridGeometry(14, 10, (u, v, p, t) => {
    const x = lerp(-pw / 2, pw / 2, u), y = lerp(yb, yt, v);
    p.copy(pt(x, y, 2.0)); t.set(x * side + 37, y);
  }, V(0, 0, side));
  add(geo, M.outer);
  // 縁: 細い筒 + ステッチ
  const edge = [];
  const push = (x, y) => edge.push(pt(x, y, 2.0));
  for (let i = 0; i <= 10; i++) push(-pw / 2, lerp(yt, yb, i / 10));
  for (let i = 1; i <= 16; i++) push(lerp(-pw / 2, pw / 2, i / 16), yb);
  for (let i = 1; i <= 10; i++) push(pw / 2, lerp(yb, yt, i / 10));
  for (let i = 1; i < 16; i++) push(lerp(pw / 2, -pw / 2, i / 16), yt);
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge, true, 'catmullrom', 0.1), 120, 1.3, 5, true), M.rim);
  const st = [], hem = [];
  for (let i = 0; i <= 10; i++) st.push(pt(-pw / 2 + 4, lerp(yt, yb + 4, i / 10), 2.6));
  for (let i = 1; i <= 16; i++) st.push(pt(lerp(-pw / 2 + 4, pw / 2 - 4, i / 16), yb + 4, 2.6));
  for (let i = 1; i <= 10; i++) st.push(pt(pw / 2 - 4, lerp(yb + 4, yt, i / 10), 2.6));
  for (let i = 0; i <= 16; i++) hem.push(pt(lerp(-pw / 2, pw / 2, i / 16), yt - 10, 2.6));
  line(st); line(hem);
}

// ---------------------------------------------------------------- 閉じ方
function buildClosure(S_, closure, flap, flapBottom) {
  const { cfg, body, h, add, group, M, topA, topB } = S_;
  if (!closure) return;
  if (closure === 'zip' && cfg.zipStyle === 'around') {
    const pts = [];
    if (cfg.fam === 'backpack') {   // 前の面のふちを、わきから上をこえて反対のわきへ
      for (let i = 0; i <= 60; i++) { const u = i / 60, s = lerp(-0.2, 0.2, u), t = 0.45 + 0.55 * Math.sin(PI * u) ** 0.35; pts.push(body.point(Math.min(t, 0.995), s).addScaledVector(body.normal(Math.min(t, 0.995), s), 1.2)); }
    } else {                        // 口のふちをぐるり
      for (let i = 0; i <= 80; i++) { const s = 0.27 + 0.96 * i / 80; pts.push(body.point(0.996, s).addScaledVector(body.normal(0.996, s), 1.2)); }
    }
    const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const zr = cfg.fam === 'backpack' ? 4.5 : 3;
    add(new THREE.TubeGeometry(cv, 160, zr, 6, false), M.zipTape);
    add(new THREE.TubeGeometry(cv, 160, zr * 0.5, 6, false), M.metal);
    for (const u of [0.32, 0.36]) {
      const p = cv.getPointAt(u), tab = new THREE.Mesh(new THREE.BoxGeometry(7, 22, 2.5), M.metal);
      tab.position.copy(p).add(V(0, -11, 4)); tab.rotation.x = 0.25; group.add(tab);
    }
    return;
  }
  if (closure === 'zip' && cfg.closedTop) {
    const yTop = h + 0.6, half = Math.max(10, topA - 10);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.6, Math.min(16, topB * 1.2 + 4)), M.zipTape);
    tape.position.set(0, yTop, 0); group.add(tape);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(half * 2 - 6, 2.4, 3.2), M.metal);
    teeth.position.set(0, yTop + 0.6, 0); group.add(teeth);
    const px = half * 0.55;
    const slider = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 9), M.metal); slider.position.set(px, yTop + 2.5, 0); group.add(slider);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 20), M.metal);
    tab.position.set(px, yTop + 2, 13); tab.rotation.x = -0.5; group.add(tab);
    return;
  }
  if (closure === 'zip') return;
  if (closure === 'frame') {
    const pts = []; for (let i = 0; i < 120; i++) { const s = i / 120; pts.push(body.point(1, s).addScaledVector(body.normal(1, s), 1.5).add(V(0, 2.5, 0))); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 3.4, 8, true), M.metal);
    for (const z of [-1, 1]) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 12), M.metal);
      ball.position.set(z * 6, h + 9, z * 2); group.add(ball);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 8), M.metal);
      stem.position.set(z * 6, h + 4, z * 2); group.add(stem);
    }
    for (const sx of [-1, 1]) {  // ちょうつがい
      const hinge = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), M.metal);
      hinge.position.copy(body.point(1, sx > 0 ? 0.25 : 0.75)).add(V(sx * 2, 1, 0)); group.add(hinge);
    }
    return;
  }
  if (closure === 'drawstring' && cfg.channelY) {
    const t = cfg.channelY / h, pts = [];
    for (let i = 0; i < 120; i++) { const s = 0.5 + i / 120; pts.push(body.point(t, s).addScaledVector(body.normal(t, s), 2.6)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 220, 2.8, 6, true), M.cord);
    if (!cfg.knapsack) for (const sx of [-1, 1]) {  // ひもの先
      const s0 = sx * 0.03, p0 = body.point(t, s0).addScaledVector(body.normal(t, s0), 3);
      const end = p0.clone().add(V(sx * 22, -Math.min(110, h * 0.35), 18));
      const mid = p0.clone().lerp(end, 0.5).add(V(sx * 4, 0, 12));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, mid, end]), 40, 2.8, 6, false), M.cord);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(7.5, 14, 10), M.bead); bead.position.copy(end); group.add(bead);
    }
    return;
  }
  if (closure === 'snap' || closure === 'button') {
    let p, n;
    if (flap) { p = body.facePoint(0, clamp((flapBottom + 14) / h, 0, 1), 1, 5.5); n = V(0, 0, 1); }
    else { const t = 1 - 16 / h; p = body.facePoint(0, t, 1, 1.5); n = body.normal(t, 0); }
    const isBtn = closure === 'button';
    const g = new THREE.CylinderGeometry(isBtn ? 10 : 7, isBtn ? 10 : 7, isBtn ? 3.5 : 2.5, 24);
    const m = new THREE.Mesh(g, isBtn ? M.bead : M.metal);
    m.position.copy(p); m.quaternion.setFromUnitVectors(V(0, 1, 0), n); group.add(m);
    if (isBtn) for (let i = 0; i < 4; i++) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4, 8), M.zipTape);
      hole.position.copy(p).add(V((i % 2 - 0.5) * 6, (Math.floor(i / 2) - 0.5) * 6, 0.4));
      hole.quaternion.copy(m.quaternion); group.add(hole);
    }
    return;
  }
  if (closure === 'tie') {
    for (const sx of [-1, 1]) {
      const p0 = body.facePoint(sx * 8, 1 - 6 / h, 1, 1.5);
      const pts = [p0, p0.clone().add(V(sx * 10, -40, 6)), p0.clone().add(V(sx * 22, -95, 10))];
      const st = strapGeometry(pts, { width: 12, thick: 2, hint: V(0, 0, 1) });
      add(st.geo, M.strap);
    }
  }
}

// ---------------------------------------------------------------- 持ち手いろいろ
function strapMesh(S_, pts, opts, mat) {
  const st = strapGeometry(pts, opts);
  S_.add(st.geo, mat || S_.M.strap);
  if ((typeof opts.width === 'number' ? opts.width : 20) >= 12 && !opts.noStitch) {
    S_.line(st.edges[0], true, S_.M.strapStitch); S_.line(st.edges[1], true, S_.M.strapStitch);
  }
  return st;
}
function boxX(S_, center, n, size) {   // 持ち手の縫いつけ(四角とバツのステッチ)
  const { line, M } = S_;
  const up = V(0, 1, 0), right = V().crossVectors(up, n).normalize(), u2 = V().crossVectors(n, right).normalize();
  const q = (a, b) => center.clone().addScaledVector(right, a * size.w / 2).addScaledVector(u2, b * size.h / 2).addScaledVector(n, 0.6);
  line([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1), q(-1, -1), q(1, 1)], true, M.strapStitch);
}

function buildHandle(S_, hd) {
  const { cfg, body, h, w, add, M, group, topA, topB } = S_;
  const type = hd.type || 'loop';
  const width = clamp(num(hd.width, type === 'shoulder' || type === 'cross' || type === 'backpack' ? 32 : 25), 6, 80);
  const thick = 3.2, att = clamp(h * 0.12, 25, 45);
  const isCord = type === 'cord';
  const hm = hd.material || S_.S.handleMaterial;
  const mat = hm === 'self' ? M.outerD : hm === 'leather' || hm === 'wood' ? M.leather : M.strap;
  const at = num(hd.at, num(S_.S.strapAt, 0));   // 持ち手の付け位置(mm、まん中から)

  if (isCord && cfg.fam === 'backpack') {    // ナップサック: 口のひもがそのまま肩ひも
    const tc = (cfg.channelY || h - 35) / h;
    for (const sx of [-1, 1]) {
      const pts = [body.point(tc, sx > 0 ? 0.3 : 0.7).addScaledVector(body.normal(tc, sx > 0 ? 0.3 : 0.7), 3)];
      const a0 = cfg.prof(tc).a, a1 = cfg.prof(0.05).a;
      for (let i = 1; i <= 9; i++) {
        const u = i / 9, t = lerp(tc - 0.03, 0.045, u);
        pts.push(body.facePoint(sx * lerp(a0 * 0.75, a1 * 0.9, Math.pow(u, 0.8)), t, -1, 4 + 34 * Math.sin(PI * u) ** 1.3));
      }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 90, 3.4, 7, false), M.cord);
      const end = pts[pts.length - 1];
      const tab = new THREE.Mesh(new THREE.BoxGeometry(22, 26, 3), mat); tab.position.copy(end).add(V(0, 4, 0)); group.add(tab);
      const g = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1.8, 8, 16), M.metal); g.position.copy(end).add(V(0, 2, -2)); group.add(g);
    }
    return;
  }

  if (type === 'loop' && hm === 'wood') {    // 木の持ち手(半円の輪+布のタブ)
    const Rw = clamp(at ? at : topA * 0.55, 45, Math.max(50, topA - 8));
    for (const side of [1, -1]) {
      const zTop = body.facePoint(0, 1, side, 2).z, yc = h + 22;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Rw, 7, 10, 40, PI), M.wood);
      ring.position.set(0, yc, zTop); group.add(ring);
      for (const sx of [-1, 1]) {
        const p0 = V(sx * Rw, yc + 4, zTop), p1 = body.facePoint(sx * Rw * 0.96, (h - att * 0.6) / h, side, 1.5);
        strapMesh(S_, [p0, p0.clone().lerp(p1, 0.5).add(V(0, 0, side * 2)), p1], { width: 26, thick: 3, hint: V(0, 0, side), mode: 'face', noStitch: true }, M.outerD);
      }
    }
    return;
  }

  if (type === 'loop' || type === 'cord') {
    const len = clamp(num(hd.len, 380), 120, 2500);
    const sep = clamp(at ? at : topA * 0.42, 20, Math.max(21, topA - width / 2 - 6));
    const R = Math.min(riseFor(sep, Math.max(len - 2 * att, 60)), Math.max(h * 1.2, 300));
    for (const side of [1, -1]) {
      const tA = (h - att) / h, tB = (h - att * 0.45) / h;
      const lift = isCord ? 3.5 : thick / 2 + 0.6;
      const ptsL = [body.facePoint(-sep, tA, side, lift), body.facePoint(-sep, tB, side, lift)];
      const ptsR = [body.facePoint(sep, tB, side, lift), body.facePoint(sep, tA, side, lift)];
      const zTop = body.facePoint(0, 1, side, lift).z;
      const arc = [];
      for (let i = 0; i <= 16; i++) {
        const th = PI - PI * i / 16;
        arc.push(V(sep * Math.cos(th), h + 4 + R * Math.sin(th), zTop + side * 0.12 * R * Math.sin(th)));
      }
      const pts = [...ptsL, ...arc, ...ptsR];
      if (isCord) {
        add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 120, Math.max(3, width / 4), 8, false), M.cordStrap);
        for (const x of [-sep, sep]) {   // ひもの付け根の布タブ
          const p = body.facePoint(x, (h - att * 0.55) / h, side, 1.2), n = body.normal((h - att * 0.55) / h, body.faceS(x, (h - att * 0.55) / h, side));
          const tabm = new THREE.Mesh(new THREE.BoxGeometry(18, att * 0.9, 2.4), M.strap); tabm.position.copy(p); tabm.lookAt(p.clone().add(n)); group.add(tabm);
        }
      } else {
        strapMesh(S_, pts, { width, thick, hint: V(0, 0, side), mode: 'face' }, mat);
        for (const x of [-sep, sep]) {
          const t = (h - att * 0.55) / h;
          boxX(S_, body.facePoint(x, t, side, thick + 0.8), body.normal(t, body.faceS(x, t, side)), { w: width - 6, h: att * 0.7 });
        }
      }
    }
    return;
  }

  if (type === 'shoulder' || type === 'cross') {
    const len = clamp(num(hd.len, type === 'cross' ? 1200 : 1000), 200, 3000);
    const tA = (h - att) / h;
    const pL = body.point(tA, 0.75).addScaledVector(body.normal(tA, 0.75), thick), pR = body.point(tA, 0.25).addScaledVector(body.normal(tA, 0.25), thick);
    const span = (pR.x - pL.x) / 2;
    const R = Math.min(riseFor(span + 15, Math.max(len - 2 * att, 100)), Math.max(h * 1.35, w * 0.9, 320));
    const arc = [];
    for (let i = 0; i <= 20; i++) {
      const th = PI - PI * i / 20;
      arc.push(V((span + 15) * Math.cos(th), h + 20 + R * Math.sin(th), -0.18 * R * Math.sin(th)));
    }
    const pts = [pL, pL.clone().add(V(-2, att * 0.6, 0)), ...arc, pR.clone().add(V(2, att * 0.6, 0)), pR];
    strapMesh(S_, pts, { width: Math.min(width, topB * 2 + 20), thick, hint: (u, p) => V(Math.sign(p.x || 1), 0, 0), mode: 'face' }, mat);
    for (const p of [pL, pR]) {   // Dカン
      const ring = new THREE.Mesh(new THREE.TorusGeometry(width * 0.45, 2, 8, 20), M.metal);
      ring.position.copy(p).add(V(Math.sign(p.x) * 3, att * 0.75, 0)); ring.rotation.y = PI / 2; group.add(ring);
    }
    return;
  }

  if (type === 'backpack') {
    const len = clamp(num(hd.len, 700), 200, 2000), bw = clamp(num(hd.width, 38), 15, 70);
    const tTop = cfg.closedTop ? 0.86 : (cfg.channelY ? (cfg.channelY - 30) / h : 0.84);
    const aTop = cfg.prof(tTop).a, aBot = cfg.prof(0.05).a;
    const bow = clamp(len * 0.035, 10, 32), N = 14;
    for (const sx of [-1, 1]) {
      const pts = [], nrm = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, t = lerp(tTop, 0.05, u);
        const x = sx * lerp(Math.min(aTop * 0.42, 55), aBot * 0.8, Math.pow(u, 1.3));
        const sS = body.faceS(x, t, -1);
        const lift = 3 + bow * Math.pow(Math.sin(PI * clamp(u * 1.08 - 0.04, 0, 1)), 1.4);
        pts.push(body.point(t, sS).addScaledVector(body.normal(t, sS), lift)); nrm.push(body.normal(t, sS));
      }
      const st = strapMesh(S_, pts, { width: (u) => lerp(bw * 1.15, bw * 0.62, smooth(0.45, 0.8, u)), thick: 4,
        hint: (u) => nrm[Math.round(u * N)], mode: 'face' }, mat);
      // 長さを変える金具
      const bp = st.curve.getPointAt(0.74), bt = st.curve.getTangentAt(0.74), bn = nrm[Math.round(0.74 * N)];
      const bk = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.8, 10, 4), M.metal);
      bk.position.copy(bp).addScaledVector(bn, 2.5);
      bk.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V().crossVectors(bt, bn).normalize(), bt, bn));
      group.add(bk);
    }
    // 肩ひもの付け根の当て布
    const yk = body.facePoint(0, tTop + 0.02, -1, 2.5);
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(Math.min(aTop * 0.9, 120), 34, 4), mat); yoke.position.copy(yk); group.add(yoke);
    // 上の手さげループ
    const pf = V(0, h - 2, Math.min(18, topB * 0.6)), pb = V(0, h - 2, -Math.min(18, topB * 0.6));
    let mid = V(0, h + 28, 0);
    if (!cfg.closedTop) { const t0 = (cfg.channelY ? cfg.channelY - 12 : h - 12) / h; pf.copy(body.facePoint(0, t0, -1, 2)); pb.copy(body.facePoint(0, t0 - 0.08, -1, 2)); mid = body.facePoint(0, t0 - 0.03, -1, 24); }
    strapMesh(S_, [pf, mid, pb], { width: 20, thick, hint: V(1, 0, 0), mode: 'width' }, mat);
    return;
  }

  if (type === 'wrist') {
    const len = clamp(num(hd.len, 260), 80, 800), Lh = len / 2.1;
    const t = (h - 18) / h, A = body.point(t, 0.25).addScaledVector(body.normal(t, 0.25), 2);
    const dir = V(0.55, -1, 0.15).normalize(), across = V(1, 0.55, 0).normalize();
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const th = TAU * i / 18;
      pts.push(A.clone().addScaledVector(dir, Lh / 2 * (1 - Math.cos(th))).addScaledVector(across, 16 * Math.sin(th)).add(V(0, 0, (i / 18 - 0.5) * 6)));
    }
    strapMesh(S_, pts, { width: Math.min(width, 16), thick: 2.6, hint: V(0, 0, 1), mode: 'face', noStitch: true }, mat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 1.8, 8, 18), M.metal);
    ring.position.copy(A).add(V(2, 0, 0)); ring.rotation.y = PI / 2; group.add(ring);
    return;
  }
}

// 柄つきの玉(結び目など)。UV を実寸(mm)にして柄の大きさをそろえる
function fabricBall(S_, pos, rx, ry, rz) {
  const g = new THREE.SphereGeometry(1, 20, 14), uv = g.attributes.uv, R = (rx + ry + rz) / 3;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TAU * R, uv.getY(i) * PI * R);
  const m = S_.add(g, S_.M.outerD); m.scale.set(rx, ry, rz); m.position.copy(pos); return m;
}

// 布1枚の帯(格子)。offset(u,v) で面の向きに少しずらす(しわ・ふくらみ)
function sheetStrip(S_, points, { width, hint = V(0, 0, 1), offset = () => 0, outward = 1, nu = 44, nv = 12, stitch = [] }) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal'), len = curve.getLength();
  const fr = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu, p = curve.getPointAt(u), t = curve.getTangentAt(u);
    const wd = V().crossVectors(t, hint).normalize(), nm = V().crossVectors(wd, t).normalize();
    fr.push({ p, wd, nm });
  }
  const Wf = typeof width === 'function' ? width : () => width;
  const at = (u, v, out) => {
    const f = fr[Math.round(u * nu)];
    return out.copy(f.p).addScaledVector(f.wd, (v - 0.5) * Wf(u)).addScaledVector(f.nm, offset(u, v));
  };
  const geo = gridGeometry(nu, nv, (u, v, p, t) => { at(u, v, p); t.set(u * len, (v - 0.5) * Wf(u)); }, fr[Math.round(nu / 2)].nm.clone().multiplyScalar(outward));
  S_.add(geo, S_.M.flapOuter); S_.add(geo, S_.M.flapLining);
  for (const v of stitch) {
    const pts = []; for (let i = 0; i <= nu; i++) { const u = i / nu; pts.push(at(u, v, V()).addScaledVector(fr[i].nm, outward * 0.7)); }
    S_.line(pts, true, S_.M.stitch);
  }
  return { curve, len, fr, at };
}

// ノットバッグ: 右に短い輪。左の長い持ち手がそこを通って、先が結んである
function buildKnot(S_, handles) {
  const { body, h, w, add, M, topA, topB } = S_, S = S_.S;
  const kLong = handles.find(x => x && x.type === 'knot') || { len: Math.max(h * 1.6, 450) };
  const ks = S.knotShort, ksLen = typeof ks === 'number' ? ks : ks && num(ks.len, 0), ksW = ks && typeof ks === 'object' ? ks.width : null;
  const kw = clamp(num(kLong.width, w * 0.17), 30, 90), sw = clamp(num(ksW, kw * 0.85), 25, 90);
  const xs = topA - sw / 2 - 4, zs = Math.max(topB * 0.95, 16);
  const Rs = ksLen ? clamp(riseFor(zs, Math.max(ksLen - 30, 60)), 35, 170) : clamp(h * 0.32, 55, 115);
  // 右: 短い輪(前とうしろがつながった、丸い輪)
  const pS = [V(xs, h - 16, zs)];
  for (let i = 0; i <= 16; i++) { const th = PI * i / 16; pS.push(V(xs, h + 4 + Rs * Math.sin(th), zs * Math.cos(th) * (1 + 0.55 * Math.sin(th)))); }
  pS.push(V(xs, h - 16, -zs));
  const loopSt = strapGeometry(pS, { width: (u) => lerp(sw, sw * 0.8, Math.sin(PI * u)), thick: 4, hint: V(1, 0, 0), mode: 'width' });
  add(loopSt.geo, M.outerD);
  S_.line(loopSt.edges[0], true, M.stitch); S_.line(loopSt.edges[1], true, M.stitch);
  // 左: 長い持ち手 → 右の輪をくぐる → 結び目 → 先が垂れる
  const L = clamp(num(kLong.len, 500), 200, 2000), rise = clamp(L * 0.32, 120, Math.max(h * 1.1, 260));
  const x0 = -xs, yIn = h + 4 + Rs * 0.42, kwT = Math.min(kw * 0.6, Rs * 0.55);
  const kx = xs + sw * 0.5 + kwT * 0.7, ky = yIn - 4;
  const pts = [
    V(x0, h - 12, 0), V(x0, h + 30, 0), V(x0 * 0.8, h + rise * 0.72, 0), V(x0 * 0.25, h + rise, 0),
    V(xs * 0.4, h + rise * 0.86, 0), V(xs - sw * 1.4, yIn + Rs * 0.35, 0), V(xs - sw * 0.6, yIn, 0),
    V(xs, yIn - 2, 0), V(kx - kwT * 0.4, ky, 0),
  ];
  const st = strapGeometry(pts, { width: (u) => lerp(kw * 1.05, kwT, smooth(0.1, 0.75, u)), thick: (u) => lerp(Math.max(topB * 2, 10), 5, smooth(0, 0.2, u)), hint: V(0, 0, 1), mode: 'face' });
  add(st.geo, M.outerD);
  S_.line(st.edges[0], true, M.stitch); S_.line(st.edges[1], true, M.stitch);
  fabricBall(S_, V(kx, ky, 0), kwT * 0.62, kwT * 0.55, Math.max(13, kwT * 0.42));   // 結び目
  const tail = strapGeometry([V(kx + kwT * 0.2, ky - 6, 2), V(kx + kwT * 0.45, ky - Rs * 0.5, 5), V(kx + kwT * 0.35, ky - Rs * 1.05, 9)],
    { width: (u) => lerp(kwT * 0.9, kwT * 1.15, u), thick: 4, hint: V(0, 0, 1) });
  add(tail.geo, M.outerD);
}

// あずま袋: 両わきから三角が上がって、上で結ぶ。三角は布1枚(前とうしろ)で、やわらかなしわ
function buildAzuma(S_, handles) {
  const { h, M, topA, topB } = S_;
  const hd = handles.find(x => x) || {};
  const rise = clamp(num(hd.len, h * 1.6) * 0.42, h * 0.45, h * 1.4);
  const wb = topA * 0.8, zb = Math.max(topB, 4);
  for (const sx of [-1, 1]) {
    const pts = [V(sx * (topA - wb / 2), h - 4, 0), V(sx * (topA - wb / 2) * 0.9, h + rise * 0.3, 0), V(sx * topA * 0.42, h + rise * 0.7, 0), V(sx * 20, h + rise, 0)];
    for (const layer of [1, -1]) {
      sheetStrip(S_, pts, {
        width: (u) => lerp(wb, 34, Math.pow(u, 0.7)), hint: V(0, 0, 1), outward: layer,
        offset: (u, v) => layer * (zb * (1 - smooth(0, 0.6, u)) * (0.85 + 0.15 * Math.sin(PI * v)) + 1.2)
          + (2.4 * Math.sin(v * PI * 3 + u * 10 + layer) + 1.6 * Math.sin(v * PI * 7 - u * 6)) * smooth(0.02, 0.25, u) * (1 - 0.6 * u),
        stitch: layer > 0 ? [sx > 0 ? 0.95 : 0.05] : [],
      });
    }
  }
  // 結び目と、結んだ先
  const ky = h + rise + 6;
  fabricBall(S_, V(0, ky, 0), 20, 15, 13);
  for (const sx of [-1, 1]) {
    sheetStrip(S_, [V(sx * 8, ky + 4, 0), V(sx * 28, ky + 26, 3), V(sx * 50, ky + 18, 7)],
      { width: (u) => lerp(26, 18, u), hint: V(0, 0, 1), offset: (u, v) => 1.5 * Math.sin(v * PI * 2 + u * 5), nu: 12, nv: 4 });
  }
}

export const FAMILY_LIST = FAMILIES;

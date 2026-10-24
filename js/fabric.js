// fabric.js — 柄係。布の柄を canvas 2D だけで描く(画像ファイルなし)。
//
// 約束(CLAUDE.md):
//   FABRICS   … 柄の一覧 {id, name, group, tileCm}
//   COLORWAYS … 色の組み {id, name, colors:[地の色, 柄の色, 差し色]}
//   drawFabric(ctx, fabricId, colorwayId, sizePx, scale=1)  … (0,0)〜(sizePx,sizePx) に 1枚ぶん描く
//   fabricCanvas(fabricId, colorwayId, sizePx, scale=1)     … キャッシュつき canvas
//   fabricThumb(fabricId, colorwayId, px=96)                … 選ぶボタン用 dataURL
//
// 1枚の絵はそのまま上下左右に並べても、つなぎ目が見えない(タイル状)。
// tileCm = その1枚が「実物の布の何cm 四方ぶんか」。3D では  繰り返し数 = 布の長さ(cm) / tileCm 。
// scale を変えても 1枚の大きさ(tileCm)はそのまま。中の柄の数が変わる(小さい柄 = scale < 1)。
// 柄の数はつなぎ目が出ないよう整数に丸めるので、scale はだいたいの値として効く。
// 乱数は固定の種(seed)。同じ引数なら毎回まったく同じ絵になる。

// ---------------------------------------------------------------- 一覧

export const FABRIC_GROUPS = [
  { id: 'muji',  name: 'むじ' },
  { id: 'shima', name: 'しま' },
  { id: 'check', name: 'チェック' },
  { id: 'dot',   name: '水玉' },
  { id: 'hana',  name: '花・葉' },
  { id: 'wa',    name: '和柄' },
];

// rep = scale 1 のとき 1枚の中に並ぶ柄の数(の目安)
export const FABRICS = [
  { id: 'plain',       name: 'むじ',           group: 'muji',  tileCm: 10, rep: 1 },
  { id: 'hanpu',       name: '帆布',           group: 'muji',  tileCm: 10, rep: 1 },
  { id: 'linen',       name: 'リネン',         group: 'muji',  tileCm: 10, rep: 1 },
  { id: 'denim',       name: 'デニム',         group: 'muji',  tileCm: 10, rep: 1 },
  { id: 'herringbone', name: 'ヘリンボーン',   group: 'muji',  tileCm: 8,  rep: 5 },
  { id: 'border',      name: 'ボーダー',       group: 'shima', tileCm: 10, rep: 4 },
  { id: 'stripe',      name: 'ストライプ',     group: 'shima', tileCm: 9,  rep: 6 },
  { id: 'gingham',     name: 'ギンガムチェック', group: 'check', tileCm: 10, rep: 6 },
  { id: 'tartan',      name: 'タータンチェック', group: 'check', tileCm: 16, rep: 2 },
  { id: 'chidori',     name: '千鳥格子',       group: 'check', tileCm: 10, rep: 8 },
  { id: 'dot',         name: '水玉',           group: 'dot',   tileCm: 9,  rep: 6 },
  { id: 'dotmix',      name: 'いろいろ水玉',   group: 'dot',   tileCm: 12, rep: 5 },
  { id: 'kobana',      name: '小花',           group: 'hana',  tileCm: 12, rep: 6 },
  { id: 'hokuo',       name: '北欧の花',       group: 'hana',  tileCm: 40, rep: 2 },
  { id: 'leaf',        name: 'リーフ',         group: 'hana',  tileCm: 20, rep: 4 },
  { id: 'sakura',      name: '桜',             group: 'wa',    tileCm: 15, rep: 5 },
  { id: 'asanoha',     name: '麻の葉',         group: 'wa',    tileCm: 14, rep: 7 },
  { id: 'seigaiha',    name: '青海波',         group: 'wa',    tileCm: 12, rep: 6 },
  { id: 'ichimatsu',   name: '市松',           group: 'wa',    tileCm: 12, rep: 4 },
  { id: 'yagasuri',    name: '矢絣',           group: 'wa',    tileCm: 12, rep: 4 },
  { id: 'shippo',      name: '七宝',           group: 'wa',    tileCm: 12, rep: 5 },
  { id: 'kikko',       name: '亀甲',           group: 'wa',    tileCm: 14, rep: 7 },
];

// colors: [地の色, 柄の色, 差し色]
export const COLORWAYS = [
  { id: 'kinari', name: '生成り',     colors: ['#ede6d4', '#34425c', '#b4574c'] },
  { id: 'kon',    name: 'こん',       colors: ['#27324a', '#e8e1cf', '#c7a14e'] },
  { id: 'sumi',   name: 'すみ',       colors: ['#2c2b2a', '#d8d2c4', '#a9493f'] },
  { id: 'karashi',name: 'からし',     colors: ['#c49a3c', '#3b3329', '#f0e9d8'] },
  { id: 'enji',   name: 'えんじ',     colors: ['#76303a', '#eee2cf', '#d4a65b'] },
  { id: 'koke',   name: 'こけ緑',     colors: ['#5a6943', '#ece5d1', '#b6773d'] },
  { id: 'pink',   name: 'くすみピンク', colors: ['#d8b2ab', '#7a4a4f', '#f5eee6'] },
  { id: 'mizu',   name: '水色',       colors: ['#a8c2cd', '#2f4c62', '#f4f0e6'] },
  { id: 'beige',  name: 'ベージュ',   colors: ['#ccb796', '#594534', '#f3ede0'] },
  { id: 'ai',     name: 'あい',       colors: ['#1f3e64', '#efebe0', '#6f98c0'] },
  { id: 'fuji',   name: '藤色',       colors: ['#a59abb', '#3d3550', '#f3eef1'] },
];

const FAB = Object.fromEntries(FABRICS.map(f => [f.id, f]));
const CW = Object.fromEntries(COLORWAYS.map(c => [c.id, c]));
export const getFabric = id => FAB[id] || FAB.plain;
export const getColorway = id => CW[id] || COLORWAYS[0];

// scale を変えたときに 1枚に並ぶ柄の数(整数)
export function repeatsFor(fabricId, scale = 1) {
  const f = getFabric(fabricId);
  return Math.max(1, Math.round(f.rep / (scale > 0 ? scale : 1)));
}

// ---------------------------------------------------------------- 小さな道具

function rng(seed) {                        // mulberry32 — 固定の種で毎回同じ並び
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  return new OffscreenCanvas(w, h);
}
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex3(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return hex3(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
function lum(hex) { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
// 明るい色は少し暗く、暗い色は少し明るく(地の色の上の控えめな線など)
function shade(hex, t) { return lum(hex) > 0.5 ? mix(hex, '#000000', t) : mix(hex, '#ffffff', t); }

// 端をまたぐ形は、反対側にも描く(つなぎ目なし)
function wrap9(S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) {
    const xx = x + dx; if (xx + r < 0 || xx - r > S) continue;
    for (const dy of [-S, 0, S]) {
      const yy = y + dy; if (yy + r < 0 || yy - r > S) continue;
      fn(xx, yy);
    }
  }
}
// ばらけた配置: n×n のマスの中で少しずらす(かたよらず、でも規則的すぎない)
function scatter(S, n, R, jitter = 0.5) {
  const pts = [], cell = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const ox = (j % 2) * 0.5;                // 段ごとに半分ずらす
    pts.push({
      x: ((i + 0.5 + ox + (R() - 0.5) * jitter) * cell) % S,
      y: (j + 0.5 + (R() - 0.5) * jitter) * cell,
      rot: R() * Math.PI * 2, k: R(), k2: R(), cell,
    });
  }
  return pts;
}
// 六角形・三角形の並び(√3 の比)を正方形の 1枚に入れるための数(ゆがみ数%以内)
function hexDims(rep) {
  let best = null;
  for (let nx = Math.max(2, Math.round(rep) - 2); nx <= Math.round(rep) + 3; nx++) {
    const ny = Math.max(1, Math.round(nx / Math.sqrt(3)));
    const err = Math.abs((ny * Math.sqrt(3)) / nx - 1) + Math.abs(nx - rep) * 0.012;
    if (!best || err < best.err) best = { nx, ny, err };
  }
  return best;
}

// ---------------------------------------------------------------- 布の地(織り目・ムラ)

// 灰色 128 を中心にした織り目の絵。overlay で重ねる(128 = 変化なし)。
// kind: 'fine' 細かい平織り / 'canvas' 帆布の太い糸 / 'linen' ふしのある糸 / 'twill' 斜めの綾織り
const noiseCache = new Map();
function weaveNoise(S, kind, T) {
  const key = S + ':' + kind + ':' + T;
  if (noiseCache.has(key)) return noiseCache.get(key);
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  const R = rng(hash(key));
  const rows = new Float32Array(T), cols = new Float32Array(T);
  const thick = kind === 'canvas' ? 0.55 : kind === 'linen' ? 0.7 : 0.35;
  for (let i = 0; i < T; i++) { rows[i] = (R() - 0.5) * thick; cols[i] = (R() - 0.5) * thick; }
  // リネンの「ふし」: 糸ごとに、ところどころ太いところ(横にのびる)
  let slub = null;
  if (kind === 'linen') {
    slub = new Float32Array(T * S);
    for (let t = 0; t < T; t++) {
      const cnt = R() < 0.5 ? 1 : 2;
      for (let k = 0; k < cnt; k++) {
        const x0 = R() * S, len = S * (0.05 + R() * 0.18), amp = (R() < 0.5 ? 1 : -0.7) * (0.35 + R() * 0.35);
        for (let x = 0; x < len; x++) {
          const xx = Math.floor(x0 + x) % S;
          slub[t * S + xx] += amp * Math.sin(Math.PI * x / len);
        }
      }
    }
  }
  // ムラ: 6×6 の値をなめらかにつなぐ(端は反対側とつながる)
  const G = 6, grid = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) grid[i] = R() - 0.5;
  const ix0 = new Int32Array(S), ix1 = new Int32Array(S), fxs = new Float32Array(S);
  for (let x = 0; x < S; x++) {
    const gx = (x / S) * G, i0 = Math.floor(gx), f = gx - i0;
    ix0[x] = i0 % G; ix1[x] = (i0 + 1) % G; fxs[x] = f * f * (3 - 2 * f);
  }
  const bump = new Float32Array(64);       // 糸の丸み(まん中が明るい)
  for (let i = 0; i < 64; i++) bump[i] = Math.sin(Math.PI * (i + 0.5) / 64) - 0.64;
  const grainAmt = kind === 'canvas' ? 0.25 : 0.18;
  const mottleAmt = kind === 'linen' ? 0.55 : 0.4;
  const K = 120;
  for (let y = 0; y < S; y++) {
    const ty = Math.floor((y * T) / S), fy = Math.floor((((y * T) / S) - ty) * 64);
    const r0 = ix0[y] * G, r1 = ix1[y] * G, fy2 = fxs[y];
    for (let x = 0; x < S; x++) {
      const tx = Math.floor((x * T) / S), fx = Math.floor((((x * T) / S) - tx) * 64);
      const warpTop = kind === 'twill' ? ((tx + ty) & 3) < 2 : ((tx + ty) & 1) === 0;
      let v = warpTop ? cols[tx] + bump[fx] * 0.55 : rows[ty] + bump[fy] * 0.55;
      if (slub && !warpTop) v += slub[ty * S + x];
      const a = grid[r0 + ix0[x]], b = grid[r0 + ix1[x]], cc = grid[r1 + ix0[x]], dd = grid[r1 + ix1[x]];
      const m = (a + (b - a) * fxs[x]) * (1 - fy2) + (cc + (dd - cc) * fxs[x]) * fy2;
      v += (R() - 0.5) * grainAmt + m * mottleAmt;
      const gv = 128 + v * K, o = (y * S + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = gv < 0 ? 0 : gv > 255 ? 255 : gv; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (noiseCache.size > 24) noiseCache.delete(noiseCache.keys().next().value);
  noiseCache.set(key, c);
  return c;
}

// 糸の太さ: 実物の糸の密度に近づけるが、1本 2px より細くはしない
function threadCount(S, tileCm, perCm, minPx = 2) {
  return Math.max(8, Math.min(Math.round(tileCm * perCm), Math.floor(S / minPx)));
}

function applyWeave(ctx, S, f, kind, perCm, strength, minPx) {
  const T = threadCount(S, f.tileCm, perCm, minPx);
  const n = weaveNoise(S, kind, T);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = strength;
  ctx.drawImage(n, 0, 0, S, S);
  ctx.restore();
}

// ---------------------------------------------------------------- 小さな形

function petalFlower(ctx, x, y, r, rot, petal, center, petals = 5) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = petal;
  for (let i = 0; i < petals; i++) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.beginPath(); ctx.ellipse(0, -r * 0.52, r * 0.34, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function sakuraPetalPath(ctx, r) {          // 先に切れこみのある桜の花びら(上向き)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-r * 0.48, -r * 0.28, -r * 0.5, -r * 0.82, -r * 0.2, -r);
  ctx.lineTo(0, -r * 0.84);
  ctx.lineTo(r * 0.2, -r);
  ctx.bezierCurveTo(r * 0.5, -r * 0.82, r * 0.48, -r * 0.28, 0, 0);
  ctx.closePath();
}
function sakuraFlower(ctx, x, y, r, rot, petal, center) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) { ctx.rotate((Math.PI * 2) / 5); sakuraPetalPath(ctx, r); ctx.fill(); }
  ctx.fillStyle = center;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = center; ctx.lineWidth = Math.max(0.6, r * 0.04); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * r * 0.36, -Math.cos(a) * r * 0.36); ctx.stroke();
    ctx.beginPath(); ctx.arc(Math.sin(a) * r * 0.38, -Math.cos(a) * r * 0.38, r * 0.045, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function leafShape(ctx, x, y, L, W, rot, fill, vein) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -L);
  ctx.bezierCurveTo(W, -L * 0.45, W * 0.9, L * 0.45, 0, L);
  ctx.bezierCurveTo(-W * 0.9, L * 0.45, -W, -L * 0.45, 0, -L);
  ctx.fill();
  if (vein) {
    ctx.strokeStyle = vein; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.6, W * 0.09);
    ctx.beginPath(); ctx.moveTo(0, -L * 0.85); ctx.lineTo(0, L * 1.15); ctx.stroke();
    ctx.lineWidth = Math.max(0.5, W * 0.06);
    for (let i = -2; i <= 2; i++) {
      const yy = i * L * 0.3;
      ctx.beginPath(); ctx.moveTo(0, yy + L * 0.12); ctx.lineTo(W * 0.55, yy - L * 0.08); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, yy + L * 0.12); ctx.lineTo(-W * 0.55, yy - L * 0.08); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 柄ごとの描き方
// どれも (ctx, S=1枚の px, c=[地,柄,差し], n=1枚に並ぶ数, R=乱数, f=柄の情報)

const DRAW = {
  plain(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    applyWeave(ctx, S, f, 'fine', 18, 0.42, 2);
  },
  hanpu(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    applyWeave(ctx, S, f, 'canvas', 9, 0.55, 3);
  },
  linen(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    applyWeave(ctx, S, f, 'linen', 12, 0.7, 2.5);
  },
  denim(ctx, S, c, n, R, f) {
    // たて糸 = 地の色(ところどころ色あせ)、よこ糸 = 白っぽい。3/1 の綾織りで斜めの線が出る
    const T = threadCount(S, f.tileCm, 13, 2.5);
    const tmp = makeCanvas(S, S), g = tmp.getContext('2d');
    const id = g.createImageData(S, S), d = id.data;
    // 地の色が明るい組みでは、柄の色(濃い方)をたて糸にする → いつも「デニムらしい」濃い布
    const base = lum(c[0]) < lum(c[1]) ? c[0] : c[1];
    const warp = rgb(base);
    const weft = rgb(mix(base, '#f4f1ea', 0.72));
    const cols = new Float32Array(T), rows = new Float32Array(T);
    for (let i = 0; i < T; i++) { cols[i] = (R() - 0.5) * 0.22 + (R() < 0.08 ? 0.18 : 0); rows[i] = (R() - 0.5) * 0.1; }
    // たて方向の色あせの筋(なめらか・つながる)
    const fadeCnt = 7, fades = [];
    for (let i = 0; i < fadeCnt; i++) fades.push({ x: R() * S, w: S * (0.03 + R() * 0.08), a: 0.06 + R() * 0.1 });
    const fadeX = new Float32Array(S);
    for (const fd of fades) for (let x = 0; x < S; x++) {
      let dx = Math.abs(x - fd.x); dx = Math.min(dx, S - dx);
      if (dx < fd.w) fadeX[x] += fd.a * (0.5 + 0.5 * Math.cos(Math.PI * dx / fd.w));
    }
    for (let y = 0; y < S; y++) {
      const ty = Math.floor((y * T) / S), fy = (y * T) / S - ty;
      for (let x = 0; x < S; x++) {
        const tx = Math.floor((x * T) / S), fx = (x * T) / S - tx;
        const warpTop = ((tx - ty) & 3) !== 0;  // 3本上・1本下
        const o = (y * S + x) * 4;
        const n0 = (R() - 0.5) * 0.08;
        if (warpTop) {
          const k = 1 + cols[tx] + fadeX[x] + n0 + (Math.sin(Math.PI * fx) - 0.64) * 0.18;
          const lift = Math.max(0, cols[tx] + fadeX[x]) * 80;
          d[o] = warp[0] * k + lift; d[o + 1] = warp[1] * k + lift; d[o + 2] = warp[2] * k + lift;
        } else {
          const k = 1 + rows[ty] + n0 + (Math.sin(Math.PI * fy) - 0.64) * 0.15;
          d[o] = weft[0] * k; d[o + 1] = weft[1] * k; d[o + 2] = weft[2] * k;
        }
        d[o + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    ctx.drawImage(tmp, 0, 0, S, S);
  },
  herringbone(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const cols = n * 2, w = S / cols;
    const K = Math.max(2, Math.round(S / (w * 0.42))), q = S / K;
    ctx.strokeStyle = mix(c[0], c[1], 0.5);
    ctx.lineWidth = q * 0.46; ctx.lineCap = 'butt';
    for (let ci = 0; ci < cols; ci++) {
      const x0 = ci * w, dir = ci % 2 ? 1 : -1, off = ci % 2 ? q * 0.5 : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, w, S); ctx.clip();
      for (let k = -2; k <= K + Math.ceil(w / q) + 2; k++) {
        const y = k * q + off;
        ctx.beginPath();
        if (dir > 0) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y - w); }
        else { ctx.moveTo(x0, y - w); ctx.lineTo(x0 + w, y); }
        ctx.stroke();
      }
      ctx.restore();
      // 列の境目の細いかげ
      ctx.fillStyle = shade(c[0], 0.12);
      ctx.fillRect(x0, 0, Math.max(0.6, w * 0.03), S);
    }
    applyWeave(ctx, S, f, 'twill', 16, 0.4, 2);
  },
  border(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const p = S / n;
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = c[1]; ctx.fillRect(0, j * p, S, p * 0.42);
      ctx.fillStyle = c[2]; ctx.fillRect(0, j * p + p * 0.69, S, p * 0.045);
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  stripe(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const p = S / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = c[1]; ctx.fillRect(i * p, 0, p * 0.2, S);
      ctx.fillStyle = c[2]; ctx.fillRect(i * p + p * 0.58, 0, p * 0.035, S);
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  gingham(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const p = S / n;
    ctx.fillStyle = c[1];
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < n; i++) ctx.fillRect(i * p, 0, p / 2, S);
    for (let j = 0; j < n; j++) ctx.fillRect(0, j * p, S, p / 2);
    ctx.globalAlpha = 1;
    applyWeave(ctx, S, f, 'fine', 18, 0.4, 2);
  },
  tartan(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const p = S / n, u = p / 32;
    const light = lum(c[0]) > 0.5 ? '#ffffff' : '#f2ecdf';
    const bands = [                          // [始まり, 太さ, 色, こさ] (単位 u)
      [0, 11, c[1], 0.55],
      [14, 1.4, c[2], 0.85],
      [18.5, 6, mix(c[1], c[0], 0.3), 0.32],
      [28, 0.8, light, 0.55],
    ];
    for (const [s, w, col, a] of bands) {
      ctx.fillStyle = col; ctx.globalAlpha = a;
      for (let i = 0; i < n; i++) {
        ctx.fillRect(i * p + s * u, 0, w * u, S);
        ctx.fillRect(0, i * p + s * u, S, w * u);
      }
    }
    ctx.globalAlpha = 1;
    applyWeave(ctx, S, f, 'twill', 14, 0.45, 2);
  },
  chidori(ctx, S, c, n, R, f) {
    // 本物と同じしくみ: 4本ずつの色の糸を 2/2 の綾で織ると千鳥格子になる
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const m = n * 8, u = S / m;
    ctx.fillStyle = c[1];
    for (let y = 0; y < m; y++) {
      const weftDark = (y % 8) < 4;
      for (let x = 0; x < m; x++) {
        const warpDark = (x % 8) < 4;
        const warpTop = ((x + y) & 3) < 2;
        if (warpTop ? warpDark : weftDark) ctx.fillRect(x * u - 0.25, y * u - 0.25, u + 0.5, u + 0.5);
      }
    }
    applyWeave(ctx, S, f, 'twill', 16, 0.35, 2);
  },
  dot(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const p = S / n, r = p * 0.19;
    ctx.fillStyle = c[1];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      for (const [x, y] of [[i * p, j * p], [i * p + p / 2, j * p + p / 2]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  dotmix(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const sizes = [0.12, 0.18, 0.26];
    for (const pt of scatter(S, n, R, 0.4)) {
      const r = pt.cell * sizes[Math.floor(pt.k * 3)];
      ctx.fillStyle = pt.k2 < 0.25 ? c[2] : c[1];
      wrap9(S, pt.x, pt.y, r, (x, y) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  kobana(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const leafC = mix(c[1], c[0], 0.45);
    const pts = scatter(S, n, R, 0.45);
    for (const pt of pts) {                  // 葉っぱを先に(花の下)
      const r = pt.cell * 0.2;
      wrap9(S, pt.x, pt.y, r * 2.2, (x, y) => {
        leafShape(ctx, x + Math.cos(pt.rot) * r * 1.25, y + Math.sin(pt.rot) * r * 1.25, r * 0.55, r * 0.28, pt.rot + Math.PI / 2, leafC);
        leafShape(ctx, x + Math.cos(pt.rot + 2.4) * r * 1.2, y + Math.sin(pt.rot + 2.4) * r * 1.2, r * 0.45, r * 0.24, pt.rot + 2.4 + Math.PI / 2, leafC);
      });
    }
    for (const pt of pts) {
      const r = pt.cell * (0.18 + pt.k * 0.06);
      const petal = pt.k2 < 0.3 ? c[2] : c[1];
      const center = pt.k2 < 0.3 ? c[1] : (lum(c[0]) > 0.5 ? c[0] : c[2]);
      wrap9(S, pt.x, pt.y, r, (x, y) => petalFlower(ctx, x, y, r, pt.rot, petal, center, 5));
    }
    // すきまの小さな点
    ctx.fillStyle = leafC;
    for (const pt of scatter(S, n, R, 0.3)) {
      const x = (pt.x + pt.cell * 0.5) % S, y = (pt.y + pt.cell * 0.5) % S, r = pt.cell * 0.035;
      wrap9(S, x, y, r, (xx, yy) => { ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill(); });
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  hokuo(ctx, S, c, n, R, f) {
    // 大きな花(北欧の手描き風)。半分ずらして並べる
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const p = S / n;
    const leafC = mix(c[1], c[0], 0.35);
    const flowers = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      flowers.push({ x: (i + 0.3) * p, y: (j + 0.32) * p, r: p * 0.24, k: (i + j) % 2, rot: R() * 0.6 });
      flowers.push({ x: (i + 0.8) * p, y: (j + 0.82) * p, r: p * 0.17, k: (i + j + 1) % 2, rot: R() * 0.6 });
    }
    for (const fl of flowers) {               // くき と 葉
      wrap9(S, fl.x, fl.y, fl.r * 3.2, (x, y) => {
        ctx.strokeStyle = leafC; ctx.lineWidth = fl.r * 0.09; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + fl.r * 0.5, y + fl.r * 1.6, x + fl.r * 0.1, y + fl.r * 2.7); ctx.stroke();
        leafShape(ctx, x + fl.r * 0.7, y + fl.r * 1.6, fl.r * 0.55, fl.r * 0.24, 0.9, leafC, null);
        leafShape(ctx, x - fl.r * 0.3, y + fl.r * 2.05, fl.r * 0.5, fl.r * 0.22, -0.8, leafC, null);
      });
    }
    for (const fl of flowers) {
      const main = fl.k ? c[1] : c[2] === c[0] ? c[1] : mix(c[1], c[2], 0.55);
      wrap9(S, fl.x, fl.y, fl.r * 1.05, (x, y) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(fl.rot);
        ctx.fillStyle = main;                 // 丸い花びら 7まい
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * fl.r * 0.62, Math.sin(a) * fl.r * 0.62, fl.r * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = c[0];
        ctx.beginPath(); ctx.arc(0, 0, fl.r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fl.k ? c[2] : c[1];
        ctx.beginPath(); ctx.arc(0, 0, fl.r * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c[0];                 // まん中の点々
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(Math.cos(a) * fl.r * 0.22, Math.sin(a) * fl.r * 0.22, fl.r * 0.045, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
    }
    applyWeave(ctx, S, f, 'fine', 14, 0.38, 2);
  },
  leaf(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const cols = [c[1], mix(c[1], c[0], 0.4), c[2]];
    const vein = c[0];
    for (const pt of scatter(S, n, R, 0.35)) {
      const L = pt.cell * (0.34 + pt.k * 0.08), W = L * 0.42;
      const rot = -0.7 + pt.k2 * 1.4;
      const fill = cols[pt.k2 < 0.18 ? 2 : pt.k < 0.5 ? 0 : 1];
      wrap9(S, pt.x, pt.y, L * 1.2, (x, y) => leafShape(ctx, x, y, L, W, rot, fill, vein));
      const x2 = pt.x + pt.cell * 0.5, y2 = pt.y + pt.cell * 0.05, L2 = L * 0.55;
      wrap9(S, x2 % S, y2 % S, L2 * 1.2, (x, y) => leafShape(ctx, x, y, L2, L2 * 0.42, rot + 1.2, cols[1], vein));
    }
    applyWeave(ctx, S, f, 'fine', 16, 0.35, 2);
  },
  sakura(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const soft = mix(c[1], c[0], 0.4);
    const pts = scatter(S, n, R, 0.4);
    for (const pt of pts) {                   // 舞う花びら
      const x = (pt.x + pt.cell * 0.5) % S, y = (pt.y + pt.cell * 0.45) % S, r = pt.cell * 0.11;
      wrap9(S, x, y, r, (xx, yy) => {
        ctx.save(); ctx.translate(xx, yy); ctx.rotate(pt.rot * 1.7); ctx.translate(0, r * 0.5);
        ctx.fillStyle = soft; sakuraPetalPath(ctx, r); ctx.fill(); ctx.restore();
      });
    }
    for (const pt of pts) {
      const r = pt.cell * (0.24 + pt.k * 0.08);
      const petal = pt.k2 < 0.35 ? soft : c[1];
      wrap9(S, pt.x, pt.y, r, (x, y) => sakuraFlower(ctx, x, y, r, pt.rot, petal, c[2]));
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  asanoha(ctx, S, c, n, R, f) {
    // 三角形のます目 + 三角形の中心から3つの角へ線 = 麻の葉
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const { nx, ny } = hexDims(n);
    const a = 1, h = Math.sqrt(3) / 2;
    ctx.save();
    ctx.scale(S / nx, S / (ny * 2 * h));
    ctx.strokeStyle = c[1]; ctx.lineWidth = 0.035; ctx.lineJoin = 'round';
    const rows = ny * 2;
    for (let r = -1; r <= rows; r++) {
      const y0 = r * h, y1 = (r + 1) * h;
      const offT = (((r % 2) + 2) % 2) * 0.5, offB = (((r + 1) % 2 + 2) % 2) * 0.5;
      for (let i = -1; i <= nx + 1; i++) {
        const tri = [
          [[i + offT, y0], [i + offT + a, y0], [i + offT + 0.5, y1]],   // 下向き
          [[i + offB, y1], [i + offB + a, y1], [i + offB + 0.5, y0]],   // 上向き
        ];
        for (const t of tri) {
          const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
          ctx.beginPath();
          ctx.moveTo(t[0][0], t[0][1]); ctx.lineTo(t[1][0], t[1][1]); ctx.lineTo(t[2][0], t[2][1]); ctx.closePath();
          for (const v of t) { ctx.moveTo(cx, cy); ctx.lineTo(v[0], v[1]); }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  seigaiha(ctx, S, c, n, R, f) {
    // 半分ずつ重なる同心円。上の段から順に描く
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const Rr = S / (2 * n), rows = Math.round(S / (Rr / 2));
    const rings = [0.93, 0.71, 0.49, 0.27];
    for (let j = -2; j <= rows + 2; j++) {
      const y = j * Rr / 2, off = ((j % 2) + 2) % 2 ? Rr : 0;
      for (let i = -1; i <= n; i++) {
        const x = i * 2 * Rr + off;
        ctx.fillStyle = c[0];
        ctx.beginPath(); ctx.arc(x, y, Rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = c[1]; ctx.lineWidth = Rr * 0.085;
        for (const k of rings) { ctx.beginPath(); ctx.arc(x, y, Rr * k, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = c[2];
        ctx.beginPath(); ctx.arc(x, y, Rr * 0.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  ichimatsu(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const m = n * 2, q = S / m;
    ctx.fillStyle = c[1];
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) if ((i + j) % 2) ctx.fillRect(i * q, j * q, q, q);
    applyWeave(ctx, S, f, 'fine', 18, 0.4, 2);
  },
  yagasuri(ctx, S, c, n, R, f) {
    // たての列に矢羽根。となりの列は半分ずらす
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const cols = n * 2, w = S / cols;
    const K = Math.max(2, Math.round(S / (w * 1.3))), h = S / K;
    for (let ci = 0; ci < cols; ci++) {
      const x = ci * w, off = ci % 2 ? h / 2 : 0;
      ctx.fillStyle = c[1];
      for (let k = -1; k <= K; k++) {
        const y = k * h + off;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y + h * 0.28); ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h * 0.5); ctx.lineTo(x + w / 2, y + h * 0.78); ctx.lineTo(x, y + h * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = c[2];                  // 列の間の細い線
      ctx.fillRect(x - w * 0.015, 0, w * 0.03, S);
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.38, 2);
  },
  shippo(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const d = S / n, r = d / 2;
    const centers = [];
    for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
      centers.push([i * d, j * d], [i * d + d / 2, j * d + d / 2]);
    }
    ctx.strokeStyle = c[1]; ctx.lineWidth = d * 0.055;
    for (const [x, y] of centers) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    // 円のまん中の星形のところに、小さな花びし
    ctx.fillStyle = c[2];
    for (const [x, y] of centers) {
      const s = d * 0.075;
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.6); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 1.6, y); ctx.lineTo(x, y - s); ctx.lineTo(x + s * 1.6, y); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill();
    }
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
  kikko(ctx, S, c, n, R, f) {
    ctx.fillStyle = c[0]; ctx.fillRect(0, 0, S, S);
    const { nx, ny } = hexDims(n);
    const h = Math.sqrt(3) / 2, Rh = 1 / Math.sqrt(3);
    ctx.save();
    ctx.scale(S / nx, S / (ny * 2 * h));
    const hex = (x, y, rad) => {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    // 縦向きの六角形 → 中心は (i + 段で0.5ずらし, 段 × √3/2)
    for (let r = -1; r <= ny * 2 + 1; r++) {
      const off = (((r % 2) + 2) % 2) * 0.5;
      for (let i = -1; i <= nx + 1; i++) {
        const x = i + off, y = r * h;
        ctx.strokeStyle = c[1]; ctx.lineWidth = 0.06; hex(x, y, Rh * 1.0); ctx.stroke();
        ctx.lineWidth = 0.028; hex(x, y, Rh * 0.74); ctx.stroke();
        ctx.fillStyle = c[2]; hex(x, y, Rh * 0.16); ctx.fill();
      }
    }
    ctx.restore();
    applyWeave(ctx, S, f, 'fine', 18, 0.35, 2);
  },
};

// ---------------------------------------------------------------- 公開する関数

export function drawFabric(ctx, fabricId, colorwayId, sizePx, scale = 1) {
  const f = getFabric(fabricId);
  const cw = getColorway(colorwayId);
  const S = Math.max(8, Math.round(sizePx));
  const n = repeatsFor(f.id, scale);
  const R = rng(hash(f.id + '|' + cw.id + '|' + n));
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.clip();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  (DRAW[f.id] || DRAW.plain)(ctx, S, cw.colors, n, R, f);
  ctx.restore();
}

const canvasCache = new Map();
const CACHE_MAX = 48;
export function fabricCanvas(fabricId, colorwayId, sizePx, scale = 1) {
  const S = Math.max(8, Math.round(sizePx));
  const key = getFabric(fabricId).id + '|' + getColorway(colorwayId).id + '|' + S + '|' + repeatsFor(fabricId, scale);
  if (canvasCache.has(key)) {
    const c = canvasCache.get(key);
    canvasCache.delete(key); canvasCache.set(key, c);    // 最近使った順
    return c;
  }
  const c = makeCanvas(S, S);
  drawFabric(c.getContext('2d'), fabricId, colorwayId, S, scale);
  canvasCache.set(key, c);
  if (canvasCache.size > CACHE_MAX) canvasCache.delete(canvasCache.keys().next().value);
  return c;
}

// 選ぶボタン用。小さい絵でも柄が分かるよう、1枚の一部(だいたい 6〜10cm 四方)を見せる
export function fabricThumb(fabricId, colorwayId, px = 96) {
  const f = getFabric(fabricId);
  const P = Math.max(16, Math.round(px));
  const showCm = Math.min(f.tileCm, Math.max(6, Math.min(10, f.tileCm / 2)));
  const frac = showCm / f.tileCm;                       // 1枚の何割を見せるか
  const big = Math.min(1024, Math.round(P / frac));
  const src = fabricCanvas(fabricId, colorwayId, big);
  const out = makeCanvas(P, P), g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, big * frac, big * frac, 0, 0, P, P);
  if (out.toDataURL) return out.toDataURL('image/png');
  return null;
}

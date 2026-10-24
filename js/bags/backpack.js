// backpack.js — リュック・ボディバッグの仲間(型紙係C)
// 単位 mm。できあがり線で作る(縫い代は seam で足す)。y は下向き。
import { rect, roundRect, quad, arc, join, length, sub } from '../geom.js';
import { strapPiece, foldPocket, placeBox, r5, cmText } from './parts.js';
import { PRINT, cutStep, markStep, zigzag, fuse, MOUTH, finish, TURN } from './steps-common.js';

// ---------- この仲間とおでかけの仲間で使う道具 ----------

// 底のマチ(角を c 四方切りとる)の本体。上が口。点の番号:
// 0 左上 1 右上 2 右わきの下 3 角(よこの辺のおわり) 4 底の右 5 底の左 6 角 7 左わきの下
export function boxOutline(W, H, c) {
  return [[0, 0], [W, 0], [W, H - c], [W - c, H - c], [W - c, H], [c, H], [c, H - c], [0, H - c]];
}

// 長い帯(布に直接線を引く)。縫い代こみの大きさ。点1→点2 が できあがりの長さ L(長さのチェック用)。
export function stripOutline(L, D, s = 10) {
  return [[0, 0], [s, 0], [s + L, 0], [2 * s + L, 0], [2 * s + L, D + 2 * s], [0, D + 2 * s]];
}

// 角を丸くする(点 i を 半径 r の円弧にかえる)。どんな角度の角でもよい。
export function fillet(poly, i, r) {
  const n = poly.length;
  const P = poly[i], A = poly[(i - 1 + n) % n], B = poly[(i + 1) % n];
  const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
  const ua = [(A[0] - P[0]) / la, (A[1] - P[1]) / la], ub = [(B[0] - P[0]) / lb, (B[1] - P[1]) / lb];
  const th = Math.acos(Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1])));
  const t = Math.min(r / Math.tan(th / 2), la * 0.98, lb * 0.98);
  const rr = t * Math.tan(th / 2);
  const T1 = [P[0] + ua[0] * t, P[1] + ua[1] * t], T2 = [P[0] + ub[0] * t, P[1] + ub[1] * t];
  const bl = Math.hypot(ua[0] + ub[0], ua[1] + ub[1]);
  const bis = [(ua[0] + ub[0]) / bl, (ua[1] + ub[1]) / bl];
  const dc = rr / Math.sin(th / 2);
  const C = [P[0] + bis[0] * dc, P[1] + bis[1] * dc];
  const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
  let da = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const k = Math.max(4, Math.ceil(Math.abs(da) * 180 / Math.PI / 6));
  const pts = [];
  for (let j = 0; j <= k; j++) { const a = a1 + (da * j) / k; pts.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]); }
  return [...poly.slice(0, i), ...pts, ...poly.slice(i + 1)];
}

// いちばん近い点の番号
export function idxOf(outline, pt) {
  let best = 0, bd = Infinity;
  outline.forEach((q, i) => { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < bd) { bd = d; best = i; } });
  return best;
}

// 点 i0 → i1 の線の長さ
export const pathLen = (o, i0, i1) => length(sub(o, i0, i1));

// ギャザーの印: 縫い代に あらい目の線2本 + 波の線 + 文字。y は口(できあがり線)。dir = -1 なら 上の辺(縫い代は上)、+1 なら 下の辺
export function gatherMarks(x0, x1, y, toMm, dir = -1, what = '') {
  const marks = [
    { type: 'line', pts: [[x0, y + dir * 4], [x1, y + dir * 4]] },
    { type: 'line', pts: [[x0, y + dir * 7], [x1, y + dir * 7]] },
  ];
  const wy = y - dir * 24, amp = 2.2, step = 12, wave = [];
  const xa = x0 + 15, xb = x1 - 15;
  for (let x = xa, k = 0; x <= xb + 0.01; x += step / 2, k++) wave.push([x, wy + (k % 2 ? amp : -amp)]);
  if (wave.length > 2) marks.push({ type: 'line', pts: wave });
  marks.push({ type: 'text', at: [(x0 + x1) / 2, y - dir * 9], text: `${dir < 0 ? '↑' : '↓'}ギャザーを寄せて${cmText(toMm)}cmにする${what}`, size: 3.4 });
  marks.push({ type: 'text', at: [(x0 + x1) / 2, y - dir * 15], text: '縫い代にあらい目のミシンを2本かけて、糸を引く', size: 2.8 });
  return marks;
}

// 市販のファスナー(cm)で、mm 以下のいちばん長いもの
const ZIPS = [12, 15, 18, 20, 25, 30, 40, 50, 60];
export function zipAtMost(mm) {
  let z = ZIPS[0];
  for (const v of ZIPS) if (v * 10 <= mm + 0.5) z = v;
  return z;
}

const r50 = (v) => Math.ceil(v / 50) * 50;

// 送りカン(長さ調節の金具)の通し方
const SLIDE = '送りカン→Dカン→送りカンの順に通し、はしを送りカンのまん中の棒に巻いて縫いとめます';

// ---------- ① ナップサック ----------
export const bpKnapsack = {
  id: 'bp-knapsack',
  name: 'ナップサック',
  group: 'backpack',
  level: 1,
  trend: false,
  desc: 'ひもを引くと口がしまり、そのひもでせおう袋。まっすぐ縫うだけ。',
  sizes: {
    S: { w: 280, h: 330, d: 0, casing: 25, openStop: 60, cord: 1500, cordW: 5 },
    M: { w: 350, h: 420, d: 0, casing: 25, openStop: 70, cord: 1800, cordW: 6 },
    L: { w: 400, h: 480, d: 0, casing: 30, openStop: 80, cord: 2000, cordW: 7 },
  },
  sizeNote: { S: 'お孫さん用・体操服入れ', M: 'おとなの散歩・ジム', L: '上着・レジャーシートも入る' },
  sizeText: (p) => `よこ${cmText(p.w)}cm×たて${cmText(p.h)}cm`,

  shape(p) {
    return {
      family: 'backpack', w: p.w, h: p.h, d: 30, corner: 0, topW: r5(p.w * 0.35),
      flap: null, closure: 'drawstring',
      handles: [{ type: 'cord', len: p.cord, width: p.cordW }],
      pocket: null,
    };
  },

  pieces(p) {
    const { w, h } = p, cs = p.casing;
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer',
        outline: rect(w, h), seam: [cs + 10, 10, 10, 10], fold: 'bottom',
        grain: [[w * 0.12, h * 0.25], [w * 0.12, h * 0.75]],
        labelAt: [w / 2, h * 0.58],
        marks: [
          { type: 'line', pts: [[0, -cs], [w, -cs]], label: '①ここで1cm折る' },
          { type: 'text', at: [w / 2, 7], text: `↑②ここで${cmText(cs)}cm折る(ひも通し)`, size: 3.2 },
          { type: 'dot', at: [0, p.openStop], label: 'あき止まり' },
          { type: 'dot', at: [w, p.openStop] },
          { type: 'text', at: [w / 2, cs + (p.openStop - cs) / 2 + 4], text: 'わきは口からあき止まりまで縫わない', size: 3 },
          { type: 'notch', at: [0, h - 20] }, { type: 'notch', at: [w, h - 20] },
          { type: 'text', at: [6, h - 20], text: '←ループをはさむ', size: 3, anchor: 'start' },
          { type: 'text', at: [w - 6, h - 20], text: 'ループをはさむ→', size: 3, anchor: 'end' },
          { type: 'notch', at: [w / 2, 0] },
        ],
      },
      {
        ...strapPiece({ id: 'loop', name: 'ループ(ひもを結ぶ所)', cut: 2, fabric: 'accent', finLen: 80, finW: 15, tuck: 0 }),
        note: '四つ折りにして縫い、半分に折って輪にする',
      },
    ];
  },

  matches() {
    return [{ label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 3, to: 0 } }];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体を1枚', { fold: true }),
      markStep(['合い印(▲)', 'あき止まり(●)', '口の折り線']),
      'ループは布に線を引いて2本切り、四つ折りにして縫います。半分に折って輪にします。',
      `${zigzag('両わき')}わきは割るので、1枚ずつかけます。`,
      '本体を表どうしを内側にして底で折り、両わきの下の印に、ループを輪が内がわになるようにはさみます。',
      'あき止まりから下の両わきを縫います。ループの所は、2回縫って丈夫にします。',
      'わきの縫い代をアイロンで割り、あき止まりより上は、縫い代をコの字に縫いとめます。',
      `口を1cm折り、さらに${cmText(p.casing)}cm折って、下のはしを縫います(ひも通し)。わきの縫い代は、割ったまま折ります。`,
      `表に返し、ひも(${cmText(p.cord)}cm)を右のあきから1本ぐるりと通して、両はしを右のループに通して結びます。`,
      'もう1本を左のあきから同じように通し、左のループに結んだら、できあがりです。',
    ];
  },

  extras(p) {
    return [`丸ひも(太さ${p.cordW}mm)${cmText(p.cord)}cmを2本`, 'ひも通し(安全ピンでもできます)'];
  },
};

// ---------- ② 巾着リュック ----------
export const bpKinchaku = {
  id: 'bp-kinchaku',
  name: '巾着リュック',
  group: 'backpack',
  level: 2,
  trend: true,
  desc: '口は巾着、背中に肩ひもがついた丸っこいリュック。長さを変えられます。',
  sizes: {
    S: { w: 250, h: 300, d: 100, casing: 25, kinH: 130, flapH: 90, strapLen: 650, tapeW: 25, loopLen: 150, loopW: 20 },
    M: { w: 300, h: 360, d: 120, casing: 25, kinH: 150, flapH: 110, strapLen: 750, tapeW: 25, loopLen: 150, loopW: 20 },
    L: { w: 340, h: 420, d: 140, casing: 30, kinH: 170, flapH: 130, strapLen: 850, tapeW: 30, loopLen: 180, loopW: 25 },
  },
  sizeNote: { S: 'お散歩の小物', M: 'A4と水筒', L: '1日のおでかけ・山歩き' },

  shape(p) {
    return {
      family: 'backpack', w: p.w, h: p.h, d: p.d, corner: 0, topW: r5(p.w * 0.5),
      flap: { h: p.flapH, shape: 'round' }, closure: 'drawstring',
      handles: [{ type: 'backpack', len: p.strapLen, width: p.tapeW }, { type: 'loop', len: p.loopLen, width: p.loopW }],
      pocket: { w: r5(p.w * 0.6), h: r5(p.h * 0.35), side: 'front' },
    };
  },

  pieces(p) {
    const W = p.w + p.d, c = p.d / 2, H = p.h + c, cx = W / 2, cs = p.casing;
    const pw = r5(p.w * 0.6), ph = r5(p.h * 0.35);
    const py = H - c - ph - r5(p.h * 0.12);
    const fw = r5(p.w * 0.8), fr = r5(p.flapH * 0.45);
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: boxOutline(W, H, c), seam: 10, fold: 'bottom',
        grain: [[W * 0.1, H * 0.2], [W * 0.1, H * 0.6]],
        labelAt: [cx, py * 0.55],
        marks: [
          { type: 'notch', at: [cx, 0] },
          { type: 'notch', at: [cx - p.tapeW - 5, 0] }, { type: 'notch', at: [cx + p.tapeW + 5, 0] },
          { type: 'text', at: [cx, 9], text: '▲後ろの口:肩ひも・手さげ・ふたを付ける所', size: 3 },
          placeBox(cx - pw / 2, py, pw, ph, '(前だけ)前ポケット付け位置'),
          { type: 'notch', at: [0, H - c - 25] }, { type: 'notch', at: [W, H - c - 25] },
          { type: 'text', at: [5, H - c - 25], text: '←Dカン通し', size: 3, anchor: 'start' },
          { type: 'text', at: [W - 5, H - c - 25], text: 'Dカン通し→', size: 3, anchor: 'end' },
          { type: 'text', at: [W - c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'text', at: [c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'text', at: [cx, H - 14], text: '裏布はわきに返し口12cm', size: 3 },
          { type: 'text', at: [cx, H - 8], text: '接着芯は細い線(できあがり線)で切る', size: 3 },
        ],
      },
      {
        // 大きな長方形なので 布に直接線を引く。点1→2 = できあがりの幅 W(長さのチェック用)
        id: 'kin', name: '巾着(口布)', cut: 2, fabric: 'lining', unit: '枚',
        outline: [[0, 0], [10, 0], [10 + W, 0], [20 + W, 0], [20 + W, p.kinH + cs + 20], [0, p.kinH + cs + 20]],
        seam: 0, fold: null, measureOnly: true,
        note: `縫い代こみ。上のはしを1cm、さらに${cmText(cs)}cm折ってひも通しにする。わきの1か所は、口から${cmText(cs + 5)}cmを縫わずにあけておく(ひもを出す所)`,
      },
      {
        id: 'flap', name: 'ふた', cut: 2, fabric: 'outer',
        outline: roundRect(fw, p.flapH, [0, 0, fr, fr]), seam: 10, fold: null,
        grain: [[fw * 0.15, p.flapH * 0.2], [fw * 0.15, p.flapH * 0.7]],
        labelAt: [fw / 2, p.flapH * 0.5],
        marks: [
          { type: 'notch', at: [fw / 2, 0] },
          { type: 'text', at: [fw / 2, 8], text: '↑この辺を後ろの口に付ける', size: 3 },
        ],
      },
      { ...foldPocket({ id: 'pocket', name: '前ポケット', fabric: 'accent', pw, ph }) },
      strapPiece({ id: 'handle', name: '手さげ', cut: 1, finLen: p.loopLen, finW: p.loopW, tuck: 30 }),
      {
        ...strapPiece({ id: 'tab', name: 'Dカン通し', cut: 2, finLen: 70, finW: p.tapeW, tuck: 0 }),
        note: '四つ折りにして縫い、Dカンを通して半分に折る',
      },
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
      { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 3, to: 4 } },
      { label: '口布1枚の幅 と 本体の口(半分)', a: { piece: 'kin', from: 1, to: 2 }, b: { piece: 'body', from: 0, to: 1 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体の表布と裏布を1枚ずつ', { fold: true, more: 'ふた2枚と前ポケット1枚も、型紙で切ります。' }),
      `口布2枚・手さげ1本・Dカン通し2本は、布に線を引いて切ります。${markStep(['合い印(▲)', '前ポケットの付け位置(四角)'])}`,
      `${fuse('表布の本体の裏')}前ポケットを作って、前の印に縫いつけます。`,
      'ふた2枚を表どうしを内側にして重ね、上の辺を残して縫い、表に返します。手さげとDカン通しは、四つ折りにして縫います。',
      '後ろの口のまん中に、肩ひものテープ2本・手さげ・ふたを重ね、下向きにたらして仮どめします。',
      '本体を表どうしを内側にして底で折り、わきの印にDカン通し(Dカンを通して半分に折る)をはさんで、両わきを縫います。',
      `底の角を広げてまっすぐ縫い、マチ(${cmText(p.d)}cm)を作ります。裏布も同じに縫い、わきに返し口12cmを残します。`,
      `口布2枚のわきにジグザグミシンをかけ、縫って輪にします(1か所は、口から${cmText(p.casing + 5)}cmをあける)。口を三つ折りにして縫います(ひも通し)。`,
      '口布の輪を、裏が外のまま口を下に向けて表袋にかぶせ、仮どめします。裏袋をかぶせて(表どうしが内側)、口をぐるりと縫います。',
      finish(5).replace('、できあがりです。', '、口布にひもを通します。'),
      `肩ひものテープを、${SLIDE}。ひもにひもどめを付けたら、できあがりです。`,
    ];
  },

  extras(p) {
    const tape = r50(2 * (p.strapLen + 120));
    const cord = r50(2 * (p.w + p.d) + 300);
    return [
      `テープ(幅${cmText(p.tapeW)}cm)${cmText(tape)}cm(肩ひも2本ぶん)`,
      `送りカン(${p.tapeW}mm)2個`,
      `Dカン(${p.tapeW}mm)2個`,
      `丸ひも(太さ4〜5mm)${cmText(cord)}cmを1本`,
      'ひもどめ1個',
      '接着芯(本体1枚ぶん)',
    ];
  },
};

// ---------- ③ ふたつきリュック ----------
export const bpFlap = {
  id: 'bp-flap',
  name: 'ふたつきリュック',
  group: 'backpack',
  level: 3,
  trend: false,
  desc: '大きなふたとマチのある、しっかりしたリュック。毎日のおでかけに。',
  sizes: {
    S: { w: 240, h: 300, d: 100, flapH: 190, strapLen: 650, strapW: 30, loopLen: 150 },
    M: { w: 280, h: 360, d: 120, flapH: 230, strapLen: 750, strapW: 30, loopLen: 180 },
    L: { w: 320, h: 400, d: 140, flapH: 260, strapLen: 850, strapW: 38, loopLen: 200 },
  },
  sizeNote: { S: 'お財布・水筒・タオル', M: 'A4とお弁当', L: '1泊のおでかけ' },

  shape(p) {
    return {
      family: 'backpack', w: p.w, h: p.h, d: p.d, corner: 20,
      flap: { h: p.flapH - p.d / 2, shape: 'round' }, closure: 'snap',
      handles: [{ type: 'backpack', len: p.strapLen, width: p.strapW }, { type: 'loop', len: p.loopLen, width: 25 }],
      pocket: { w: r5(p.w * 0.7), h: r5(p.h * 0.35), side: 'front' },
    };
  },

  body(p) { return roundRect(p.w, p.h, [0, 0, 20, 20]); },

  pieces(p) {
    const { w, h, d } = p, cx = w / 2;
    const o = this.body(p);
    const U = pathLen(o, 1, 0);           // 右上 → 底 → 左上(マチを付けるまわり)
    const pw = r5(w * 0.7), ph = r5(h * 0.35), py = h - ph - 30;
    const fr = r5(Math.min(p.flapH, w) * 0.5);
    const mag = Math.max(40, p.flapH - d - 25);
    return [
      {
        id: 'body', name: '本体(前・後ろ)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: o, seam: 10, fold: null,
        grain: [[w * 0.12, h * 0.2], [w * 0.12, h * 0.6]],
        labelAt: [cx, py * 0.62],
        marks: [
          { type: 'notch', at: [cx, 0] },
          { type: 'notch', at: [cx - p.strapW - 5, 0] }, { type: 'notch', at: [cx + p.strapW + 5, 0] },
          { type: 'text', at: [cx, 9], text: '▲(後ろ)肩ひも・手さげ・ふたを付ける所', size: 3 },
          { type: 'dot', at: [cx, mag], label: '(前)マグネット' },
          placeBox(cx - pw / 2, py, pw, ph, '(前)前ポケット付け位置'),
          { type: 'notch', at: [0, h - 30] }, { type: 'notch', at: [w, h - 30] },
          { type: 'text', at: [5, h - 30], text: '←(後ろ)Dカンのテープ', size: 3, anchor: 'start' },
          { type: 'notch', at: [cx, h] },
          { type: 'text', at: [cx, h - 8], text: '裏布は1枚だけ底に返し口12cm/接着芯は細い線で切る', size: 2.8 },
        ],
      },
      {
        id: 'gusset', name: 'マチ(横と底の帯)', cut: 1, fabric: 'outer', unit: '枚',
        more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: stripOutline(U, d, 10), seam: 0, fold: null, measureOnly: true,
        note: '縫い代1cmこみ。まん中に印をつけて、本体の底のまん中に合わせる',
      },
      {
        id: 'flap', name: 'ふた', cut: 2, fabric: 'outer', more: [{ fabric: 'interfacing', cut: 1 }],
        outline: roundRect(w, p.flapH, [0, 0, fr, fr]), seam: 10, fold: null,
        grain: [[w * 0.12, p.flapH * 0.15], [w * 0.12, p.flapH * 0.55]],
        labelAt: [cx, p.flapH * 0.45],
        marks: [
          { type: 'notch', at: [cx, 0] },
          { type: 'text', at: [cx, 8], text: '↑この辺を後ろの口に付ける', size: 3 },
          { type: 'dot', at: [cx, p.flapH - 25], label: '(1枚だけ)マグネット' },
        ],
      },
      { ...foldPocket({ id: 'pocket', name: '前ポケット', fabric: 'accent', pw, ph }) },
      {
        id: 'strap', name: '肩ひも(上の部分)', cut: 2, fabric: 'outer', unit: '本',
        outline: rect(400, p.strapW * 2 + 20), seam: 0, fold: null, measureOnly: true,
        note: '縫い代1cmこみ。たて半分に折って縫い、表に返して厚い芯を入れる',
      },
      strapPiece({ id: 'handle', name: '手さげ', cut: 1, finLen: p.loopLen, finW: 25, tuck: 30 }),
    ];
  },

  matches(p) {
    const o = this.body(p);
    const bl = idxOf(o, [0, p.h - 20]);
    return [
      { label: 'マチ と 本体のまわり(横と底)', a: { piece: 'gusset', from: 1, to: 2 }, b: { piece: 'body', from: 1, to: 0 } },
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: bl, to: 0 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体を表布と裏布で2枚ずつ', { more: 'ふたは表布で2枚、前ポケットは1枚切ります。' }),
      `マチ(表布と裏布で1枚ずつ)・肩ひもの布2本・手さげ1本は、布に線を引いて切ります。${markStep(['合い印(▲)', '付け位置']).replace('型紙をはずす前に、', '本体とふたの')}`,
      '表布の本体2枚・マチ・ふた1枚の裏に、厚めの接着芯をアイロンではります(本体とふたの芯は、型紙の細い線で切る)。',
      '前ポケットを作り、前の本体の印に縫いつけます。前の本体の印に、マグネットボタンを付けます。',
      'ふた2枚を表どうしを内側にして重ね、上の辺を残して縫い、表に返します。芯のある方の印にマグネットを付けます。',
      '肩ひもの布をたて半分に折って縫い、表に返します。厚い芯を入れ、下のはしにテープをはさんで縫います。',
      '後ろの本体の口に、肩ひも2本・手さげ・ふたを重ね、何回も縫って丈夫にします。下の印には、Dカンを通したテープ(8cm)を仮どめします。',
      'マチのまん中を本体の底のまん中に合わせ、前と後ろの本体のまわりに縫います。曲がる所は、縫い代に切りこみを入れます。',
      `裏布も同じに組み立て、底に返し口12cmを残します。${MOUTH}`,
      'ミシン針を厚い布用(14〜16号)にかえます。返し口から表に返して返し口をとじ、口のふちをゆっくり縫いおさえます。',
      `肩ひものテープを、${SLIDE}。これで、できあがりです。`,
    ];
  },

  extras(p) {
    const tape = r50(2 * (p.strapLen - 380 + 120) + 160);
    return [
      'マグネットボタン1組',
      `テープ(幅${cmText(p.strapW)}cm)${cmText(tape)}cm(肩ひもの下とDカン通し)`,
      `送りカン(${p.strapW}mm)2個`,
      `Dカン(${p.strapW}mm)2個`,
      '肩ひも用の厚い芯(キルト芯など)2枚',
      '厚めの接着芯',
    ];
  },
};

// ---------- ④ ボディバッグ ----------
export const bpBody = {
  id: 'bp-body',
  name: 'ボディバッグ',
  group: 'backpack',
  level: 2,
  trend: true,
  desc: '体の前やうしろに、ななめにかけるバッグ。両手があいて歩きやすい。',
  sizes: {
    S: { w: 260, h: 150, d: 60, strapLen: 1200, strapW: 25 },
    M: { w: 300, h: 170, d: 80, strapLen: 1300, strapW: 25 },
    L: { w: 340, h: 190, d: 100, strapLen: 1400, strapW: 30 },
  },
  sizeNote: { S: 'スマホ・お財布', M: '長財布・水・ハンカチ', L: '折りたたみ傘や小さい上着も' },

  shape(p) {
    return {
      family: 'halfmoon', w: p.w, h: p.h, d: p.d, corner: 40,
      flap: null, closure: 'zip', zip: 'top',
      handles: [{ type: 'cross', len: p.strapLen, width: p.strapW }],
      pocket: { w: r5(p.w * 0.6), h: r5(p.h * 0.4), side: 'front' },
    };
  },

  // 上はゆるいカーブ(まん中がいちばん高い)、下の角は半径 40mm。点0〜24 が上のカーブ。
  body(p) {
    const { w, h } = p, k = r5(h * 0.2), R = 40;
    return join(quad([0, k], [w / 2, -k], [w, k], 24), arc(w - R, h - R, R, 0, 90), arc(R, h - R, R, 90, 180));
  },

  pieces(p) {
    const { w, h, d } = p;
    const o = this.body(p);
    const Lt = pathLen(o, 0, 24), Lb = pathLen(o, 24, 0);
    const zw = (d - 10) / 2;              // ファスナーマチ1枚の幅(2枚 + ファスナーの歯 1cm = マチ d)
    const pw = r5(w * 0.6), ph = r5(h * 0.4), py = h - ph - 25;
    return [
      {
        id: 'body', name: '本体(前・後ろ)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: o, seam: 10, fold: null,
        grain: [[w * 0.1, h * 0.3], [w * 0.1, h * 0.75]],
        labelAt: [w / 2, py * 0.62 + 6],
        marks: [
          { type: 'notch', at: [w / 2, 0] }, { type: 'notch', at: [w / 2, h] },
          { type: 'notch', at: [0, r5(h * 0.2)] }, { type: 'notch', at: [w, r5(h * 0.2)] },
          { type: 'text', at: [w / 2, 12], text: '↑上のカーブにファスナーマチ', size: 3 },
          placeBox((w - pw) / 2, py, pw, ph, '(前だけ)前ポケット付け位置'),
          { type: 'text', at: [w / 2, h - 8], text: '接着芯は細い線で切る', size: 2.8 },
        ],
      },
      {
        id: 'zipgusset', name: 'ファスナーマチ(上)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        outline: rect(Lt, zw), seam: 10, fold: null,
        grain: [[Lt * 0.2, zw / 2], [Lt * 0.8, zw / 2]],
        labelAt: [Lt / 2, zw / 2],
        marks: [
          { type: 'notch', at: [Lt / 2, 0] }, { type: 'notch', at: [Lt / 2, zw] },
          { type: 'text', at: [Lt * 0.12, zw / 2], text: '↑ファスナー側', size: 2.6 },
        ],
      },
      {
        id: 'gusset', name: 'マチ(下)', cut: 1, fabric: 'outer', unit: '枚', more: [{ fabric: 'lining', cut: 1 }],
        outline: stripOutline(Lb, d, 10), seam: 0, fold: null, measureOnly: true,
        note: '縫い代1cmこみ。まん中に印をつけて、本体の底のまん中に合わせる',
      },
      { ...foldPocket({ id: 'pocket', name: '前ポケット', fabric: 'accent', pw, ph }) },
    ];
  },

  matches() {
    return [
      { label: 'ファスナーマチ と 本体の上のカーブ', a: { piece: 'zipgusset', from: 0, to: 1 }, b: { piece: 'body', from: 0, to: 24 } },
      { label: '下のマチ と 本体の横と底', a: { piece: 'gusset', from: 1, to: 2 }, b: { piece: 'body', from: 24, to: 0 } },
    ];
  },

  zip(p) { return zipAtMost(pathLen(this.body(p), 0, 24) - 10); },

  steps(p) {
    return [
      PRINT,
      cutStep('本体とファスナーマチを、表布と裏布で2枚ずつ', { more: '前ポケットは1枚、下のマチは布に線を引いて切ります。' }),
      markStep(['合い印(▲)', '前ポケットの付け位置(四角)']),
      `${fuse('表布の本体2枚の裏')}前ポケットを作って、前の本体の印に縫いつけます。`,
      `ファスナー(${this.zip(p)}cm)の両がわに、表布のファスナーマチを1枚ずつ縫います。ファスナーより長い所は、2枚を縫い合わせます。`,
      'テープを7cmに2本切り、Dカンを通して半分に折ります。',
      '上のマチと下のマチの両はしを、Dカンのテープをはさんで縫い、輪にします。',
      '輪のマチを、前の本体のまわりに合い印をそろえて縫います。曲がる所は、縫い代に切りこみを入れます。',
      'ファスナーをあけて、後ろの本体も同じように縫い、表に返します。',
      '裏布も同じに組み立てます(上のマチは、ファスナーの所をあけて、両はしだけ縫います)。',
      '裏袋を中に入れ、あいている所を、ファスナーのきわにまつり縫いでとめます。',
      `肩ひものテープを、片方のDカンに通して縫いとめ、${SLIDE.replace('Dカン', 'もう片方のDカン')}。これで、できあがりです。`,
    ];
  },

  extras(p) {
    const tape = r50(p.strapLen + 120 + 140);
    return [
      `ファスナー${this.zip(p)}cmを1本`,
      `テープ(幅${cmText(p.strapW)}cm)${cmText(tape)}cm(肩ひもとDカン通し)`,
      `送りカン(${p.strapW}mm)1個`,
      `Dカン(${p.strapW}mm)2個`,
      '接着芯(本体2枚ぶん)',
    ];
  },
};

// ---------- ⑤ ウエストポーチ ----------
export const bpWaist = {
  id: 'bp-waist',
  name: 'ウエストポーチ',
  group: 'backpack',
  level: 2,
  trend: false,
  desc: '腰にまく小さなバッグ。お散歩や旅行で、さっと出し入れできます。',
  sizes: {
    S: { w: 180, h: 110, d: 40, beltLen: 1000, tapeW: 25 },
    M: { w: 220, h: 130, d: 50, beltLen: 1100, tapeW: 25 },
    L: { w: 260, h: 150, d: 60, beltLen: 1200, tapeW: 25 },
  },
  sizeNote: { S: 'スマホ・カギ', M: 'お財布・スマホ・ハンカチ', L: '小さいペットボトルも' },

  shape(p) {
    return {
      family: 'trapezoid', w: p.w, h: p.h, d: p.d, topW: p.w + 40, corner: 15,
      flap: null, closure: 'zip', zip: 'top',
      handles: [{ type: 'cross', len: p.beltLen, width: p.tapeW }],
      pocket: null,
    };
  },

  // 上の幅 w+40、下の幅 w の台形。下の角は半径 15mm。点0→1 が口(ファスナー)。
  body(p) {
    const T = p.w + 40;
    let o = [[0, 0], [T, 0], [T - 20, p.h], [20, p.h]];
    o = fillet(o, 3, 15);
    o = fillet(o, 2, 15);
    return o;
  },

  pieces(p) {
    const T = p.w + 40, { h, d } = p;
    const o = this.body(p);
    const Ls = pathLen(o, 1, 0);
    const bw = r5(p.w * 0.7), bh = p.tapeW + 10, by = r5((h - bh) / 2);
    return [
      {
        id: 'body', name: '本体(前・後ろ)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: o, seam: 10, fold: null,
        grain: [[T * 0.12, h * 0.25], [T * 0.12, h * 0.75]],
        labelAt: [T / 2, by + bh / 2],
        marks: [
          { type: 'text', at: [T / 2, 8], text: '↑ファスナーを付ける辺(口)', size: 3 },
          { type: 'notch', at: [T / 2, 0] }, { type: 'notch', at: [T / 2, h] },
          placeBox((T - bw) / 2, by, bw, bh, '(後ろだけ)ベルト通し付け位置'),
          { type: 'text', at: [T / 2, h - 8], text: '接着芯は細い線で切る', size: 2.8 },
        ],
      },
      {
        id: 'gusset', name: 'マチ(横と底)', cut: 1, fabric: 'outer', unit: '枚', more: [{ fabric: 'lining', cut: 1 }],
        outline: stripOutline(Ls, d, 10), seam: 0, fold: null, measureOnly: true,
        note: '縫い代1cmこみ。まん中に印をつけて、本体の底のまん中に合わせる',
      },
      {
        id: 'beltloop', name: 'ベルト通し', cut: 1, fabric: 'outer',
        outline: rect(bw, bh), seam: 10, fold: 'top',
        grain: [[bw * 0.15, bh * 0.5], [bw * 0.85, bh * 0.5]],
        labelAt: [bw / 2, bh * 0.55],
        marks: [{ type: 'text', at: [bw / 2, bh - 5], text: '下の辺を縫って筒にする', size: 2.6 }],
      },
    ];
  },

  matches(p) {
    const o = this.body(p);
    const br = idxOf(o, [p.w + 40 - 20, p.h]);
    const bl = idxOf(o, [20, p.h]);
    return [
      { label: 'マチ と 本体の横と底', a: { piece: 'gusset', from: 1, to: 2 }, b: { piece: 'body', from: 1, to: 0 } },
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: br }, b: { piece: 'body', from: bl, to: 0 }, tol: 1 },
    ];
  },

  zip(p) { return zipAtMost(p.w + 40); },

  steps(p) {
    return [
      PRINT,
      cutStep('本体を表布と裏布で2枚ずつ', { more: 'ベルト通しも1枚切ります。マチは、布に線を引いて切ります。' }),
      markStep(['合い印(▲)', 'ベルト通しの付け位置(四角)']),
      fuse('表布の本体2枚の裏'),
      'ベルト通しを表どうしを内側にして半分に折り、下の辺を縫って表に返します。両はしの縫い代は内がわに折ります。',
      'ベルト通しを後ろの本体の印に置き、上と下の辺だけ縫いつけます(左右はあけておく)。',
      `ファスナー(${this.zip(p)}cm)と前の本体の口を表どうしを内側にして重ね、裏布の本体も重ねて、3枚いっしょに縫います。表に返して、口のふちを縫いおさえます。`,
      '後ろの本体も、ファスナーの反対がわに同じように縫います。',
      '表布のマチを、まん中の印を合わせて、前の本体の横と底に縫います。丸い角は、縫い代に切りこみを入れます。',
      'ファスナーをあけて、後ろの本体にもマチを縫います。',
      `裏布のマチも同じに縫い、返し口8cmを残します。${TURN}`,
      'テープの片はしをバックルに通して縫いとめ、ベルト通しに通します。もう片はしを送りカン→バックル→送りカンの順に通して縫いとめたら、できあがりです。',
    ];
  },

  extras(p) {
    return [
      `ファスナー${this.zip(p)}cmを1本`,
      `テープ(幅${cmText(p.tapeW)}cm)${cmText(r50(p.beltLen + 100))}cm(腰に合わせて切る)`,
      `プラスチックのバックル(${p.tapeW}mm)1組`,
      `送りカン(${p.tapeW}mm)1個`,
      '接着芯(本体2枚ぶん)',
    ];
  },
};

export const BACKPACK_BAGS = [bpKnapsack, bpKinchaku, bpFlap, bpBody, bpWaist];

// shoulder.js — ショルダー・ななめがけの仲間(型紙係)
import { rect, arc, edgeLength } from '../geom.js';
import { strapPiece, foldPocket, placeBox, r5, cmText } from './parts.js';
import { PRINT, cutStep, markStep, strapSew, tackStep, MOUTH, magnet, finish, TURN } from './steps-common.js';

// ---------- このファイルで使う道具 ----------
// 多角形の中で、点 pt にいちばん近い頂点の番号
const idx = (o, pt) => {
  let best = 0, bd = Infinity;
  o.forEach((q, i) => { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < bd) { bd = d; best = i; } });
  return best;
};

// だ円の弧(角度は度。0 = 右、90 = 下)。始点・終点を含む
function ellArc(cx, cy, rx, ry, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

// 小さな布(Dカン通しなど)。布に直接 線を引いて切る。四つ折り
function tabPiece({ id = 'tab', name = 'Dカン通し', cut = 2, finW, len = 60 }) {
  const W = finW * 4;
  const marks = [1, 2, 3].map((k) => ({ type: 'line', pts: [[0, (W * k) / 4], [len, (W * k) / 4]], label: '折り線' }));
  return {
    id, name, cut, fabric: 'outer', unit: '本',
    outline: rect(len, W), seam: 0, fold: null, measureOnly: true,
    grain: [[len * 0.2, W / 2], [len * 0.8, W / 2]], marks,
    note: `四つ折りにして縫い(できあがり幅${cmText(finW)}cm)、Dカンを通して二つ折りにする`,
  };
}

// 長いひも(ななめがけ)。布の幅(110cm)に入るよう、半分の長さを2本切って まん中でつなぐ。
// 1本 = ひもの長さの半分 + 差しこみ 2cm + つなぐ縫い代 1cm(できあがりは計画どおり ひもの長さ + 4cm の布から)
function longStrap(p) {
  const s = strapPiece({ id: 'strap', name: 'ひも(2本をつなぐ)', cut: 2, finLen: p.strapLen / 2, finW: p.strapW, tuck: 15 });
  s.note += '。2本のはしを1cmの縫い代で縫いつないで、1本のひもにする(市販のテープでもよい)';
  return s;
}

// 底を「わ」にした、つまみマチの本体(半分)。W = よこ + マチ、c = マチの半分、H = 口から わ まで
function boxFoldOutline(W, H, c) {
  return [[0, 0], [W, 0], [W, H - c], [W - c, H - c], [W - c, H], [c, H], [c, H - c], [0, H - c]];
}

// ① スマホショルダー(前・後ろとふた・カードポケット・マグネット・Dカン)
export const shPhone = {
  id: 'sh-phone',
  name: 'スマホショルダー',
  group: 'shoulder',
  level: 1,
  trend: true,
  desc: 'スマホとカードだけ入る、小さなななめがけ。ふたはマグネットでとめます。',
  sizes: {
    S: { w: 110, h: 170, d: 0, flapH: 60, strapLen: 1200, strapW: 15 },
    M: { w: 120, h: 190, d: 0, flapH: 70, strapLen: 1300, strapW: 15 },
    L: { w: 140, h: 210, d: 0, flapH: 80, strapLen: 1400, strapW: 20 },
  },
  sizeNote: { S: '小さめのスマホが入る', M: 'ふつうのスマホとカード', L: '大きいスマホと小銭入れ' },

  shape(p) {
    return {
      family: 'flat', w: p.w, h: p.h, d: 0, corner: 0,
      flap: { h: p.flapH, shape: 'round' }, closure: 'snap',
      handles: [{ type: 'cross', len: p.strapLen, width: p.strapW }],
      pocket: { w: p.w, h: r5(p.h * 0.55), side: 'back' },
    };
  },

  pieces(p) {
    const { w, h, flapH: f } = p;
    const r = Math.min(r5(w * 0.3), f - 5);        // ふたの角の丸み
    const ph = r5(h * 0.55);
    // 後ろ+ふた: 時計まわり。上(ふたの先)の角が丸い。[w,f] と [0,f] は折り線のはし
    const back = [...arc(r, r, r, 180, 270, 15), ...arc(w - r, r, r, 270, 360, 15), [w, f], [w, f + h], [0, f + h], [0, f]];
    const iR = idx(back, [w, f]), iRB = idx(back, [w, f + h]), iLB = idx(back, [0, f + h]), iL = idx(back, [0, f]);
    return [
      {
        id: 'front', name: '前', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: rect(w, h), seam: 10, fold: null,
        grain: [[w * 0.15, h * 0.3], [w * 0.15, h * 0.75]],
        labelAt: [w / 2, h * 0.72],
        marks: [
          { type: 'dot', at: [w / 2, f - 20], label: 'マグネット凹(表布)' },
          { type: 'notch', at: [0, 15] }, { type: 'notch', at: [w, 15] },
          { type: 'text', at: [w / 2, 8], text: '◀Dカン通しは口から1.5cm下▶', size: 2.6 },
          { type: 'notch', at: [w / 2, h] },
          { type: 'text', at: [w / 2, h - 9], text: '裏布は底に返し口8cm', size: 2.8 },
        ],
      },
      {
        id: 'back', name: '後ろとふた(続き)', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: back, seam: 10, fold: null,
        grain: [[w * 0.15, f + h * 0.15], [w * 0.15, f + h * 0.4]],
        labelAt: [w / 2, f + (h - ph) * 0.55],
        marks: [
          { type: 'line', pts: [[0, f], [w, f]], label: '折り線(ここから上がふた)' },
          { type: 'dot', at: [w / 2, 20], label: 'マグネット凸(裏布)' },
          { type: 'line', pts: [[0, f + h - ph], [w, f + h - ph]], label: 'カードポケットの口(表布)' },
          { type: 'notch', at: [0, f + 15] }, { type: 'notch', at: [w, f + 15] },
          { type: 'notch', at: [w / 2, f + h] },
        ],
        _i: { iR, iRB, iLB, iL },
      },
      {
        id: 'card', name: 'カードポケット', cut: 1, fabric: 'accent',
        outline: rect(w, ph), seam: 10, fold: 'top',
        grain: [[w * 0.15, ph * 0.25], [w * 0.15, ph * 0.8]],
        marks: [
          { type: 'text', at: [w / 2, ph - 12], text: '二つ折りにして、わの近くを縫う', size: 2.8 },
          { type: 'notch', at: [w / 2, ph] },
        ],
      },
      tabPiece({ finW: 10, len: 60 }),
    ];
  },

  matches(p) {
    const pc = this.pieces(p).find((x) => x.id === 'back')._i;
    return [
      { label: '前のわき と 後ろのわき(右)', a: { piece: 'front', from: 1, to: 2 }, b: { piece: 'back', from: pc.iR, to: pc.iRB } },
      { label: '前のわき と 後ろのわき(左)', a: { piece: 'front', from: 3, to: 0 }, b: { piece: 'back', from: pc.iLB, to: pc.iL } },
      { label: '前の底 と 後ろの底', a: { piece: 'front', from: 2, to: 3 }, b: { piece: 'back', from: pc.iRB, to: pc.iLB } },
      { label: 'カードポケットの幅 と 前の幅', a: { piece: 'card', from: 2, to: 3 }, b: { piece: 'front', from: 2, to: 3 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('「前」と「後ろとふた(続き)」を、表布と裏布で1枚ずつ'),
      markStep(['合い印(▲)', 'マグネットの付け位置(●)', 'カードポケットの口の線']),
      '接着芯も「前」と「後ろとふた」で1枚ずつ切り、表布の裏にアイロンではります。',
      'マグネットボタンを先に付けます。凹は前の表布に、凸はふたの裏布に、印の所に付けます。',
      'カードポケットを「わ」で半分に折り、「わ」の近くを縫います。後ろの表布の下に重ねて、まわりを仮どめします。',
      `Dカン通しは布に線を引いて2本切り、四つ折りにして縫います。Dカン(${p.strapW}mm)を通して二つ折りにします。`,
      'Dカン通しを、輪を内がわに向けて、前の表布の両わきの印に仮どめします。',
      '前と後ろの表布を、表どうしを内側にして重ね、両わきと底を縫います。',
      '裏布も同じように縫います。底に、返し口8cmを縫わずに残します。',
      '表袋を表に返して裏袋の中に入れ(表どうしが内側)、口とふたのまわりを縫います。ふたの丸い所は、縫い代に切りこみを入れます。',
      `${TURN}Dカンにひものナスカンを付けたら、できあがりです。`,
    ];
  },

  extras(p) {
    return [
      'マグネットボタン(さしこみ式)1組',
      `Dカン${p.strapW}mm 2個`,
      `ナスカン${p.strapW}mm 2個`,
      `ななめがけのひも${cmText(p.strapLen)}cm(市販のショルダーひもでもよい)`,
    ];
  },
};

// ② サコッシュ(平ら・底わき・外ポケット・ひもを両わきにはさむ)
export const shSacoche = {
  id: 'sh-sacoche',
  name: 'サコッシュ',
  group: 'shoulder',
  level: 1,
  trend: false,
  desc: 'うすくて軽い、ななめがけの袋。財布と小物を入れてお散歩に。',
  sizes: {
    S: { w: 200, h: 160, d: 0, strapLen: 1200, strapW: 20 },
    M: { w: 250, h: 200, d: 0, strapLen: 1300, strapW: 20 },
    L: { w: 300, h: 240, d: 0, strapLen: 1400, strapW: 25 },
  },
  sizeNote: { S: '財布とスマホ', M: '長財布とハンカチ', L: 'A5の手帳や本も入る' },

  shape(p) {
    return {
      family: 'flat', w: p.w, h: p.h, d: 0, corner: 0,
      flap: null, closure: 'snap',
      handles: [{ type: 'cross', len: p.strapLen, width: p.strapW }],
      pocket: { w: r5(p.w * 0.6), h: r5(p.h * 0.5), side: 'front' },
    };
  },

  pieces(p) {
    const { w, h } = p;
    const pw = r5(w * 0.6), ph = r5(h * 0.5), py = r5(h * 0.28);
    const strap = longStrap(p);
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }],
        outline: rect(w, h), seam: 10, fold: 'bottom',
        grain: [[w * 0.12, h * 0.2], [w * 0.12, h * 0.7]],
        labelAt: [w / 2, py + ph / 2],
        marks: [
          { type: 'dot', at: [w / 2, 20], label: 'マグネット(裏布)' },
          { type: 'notch', at: [w / 2, 0] },
          { type: 'text', at: [w / 2, 9], text: '◀ひものはしは、両わきの口に付ける▶', size: 2.8 },
          placeBox((w - pw) / 2, py, pw, ph, '(表布の前だけ)外ポケット付け位置'),
          { type: 'text', at: [w / 2, h - 10], text: '裏布は、片方のわきに返し口10cm', size: 2.8 },
        ],
      },
      foldPocket({ id: 'pocket', name: '外ポケット', fabric: 'accent', pw, ph }),
      strap,
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 3, to: 0 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('表布と裏布を1枚ずつ', { fold: true }),
      markStep(['合い印(▲)', '外ポケットとマグネットの付け位置']),
      'ひもは布に線を引いて2本切り、はしを1cmの縫い代で縫いつないで、1本にします。',
      `${strapSew(p.strapW, 'ひも')}市販のテープでもよい。`,
      '外ポケットを「わ」で半分に折り、返し口を残して縫います。表に返して、表布の前の印に縫いつけます。',
      magnet('裏布の口のまん中の印(前と後ろ)'),
      '表布を、表どうしを内側にして底で折り、両わきを縫います。縫い代はアイロンで割ります。',
      '裏布も同じように縫います。片方のわきに、返し口10cmを縫わずに残します。',
      tackStep({ name: 'ひものはし', where: '両わきの口', tuck: 15 }),
      MOUTH,
      finish(5),
    ];
  },

  extras() { return ['マグネットボタン1組']; },
};

// ③ 半月ショルダー(半月の本体2枚・上はファスナーマチ・下は帯のマチ・Dカン)
// マチは 上マチ(ファスナー)と 下マチ をつないで輪にする。輪の長さ = 本体のまわり。
function halfmoonOutline(w, h) {
  const k = 10; // 上の両はしの丸み
  return [
    ...arc(w - k, k, k, 270, 360, 8),                 // 右上の丸み → [w, k]
    ...ellArc(w / 2, k, w / 2, h - k, 0, 180, 60),     // 下の半だ円 → [0, k]
    ...arc(k, k, k, 180, 270, 8),                     // 左上の丸み → [k, 0]
  ];
}

export const shHalfmoon = {
  id: 'sh-halfmoon',
  name: '半月ショルダー',
  group: 'shoulder',
  level: 2,
  trend: true,
  desc: 'おつきさまのような半円の形。上はファスナーでしっかりとじます。',
  sizes: {
    S: { w: 220, h: 140, d: 60, strapLen: 1200, strapW: 20, zip: 200 },
    M: { w: 280, h: 170, d: 80, strapLen: 1300, strapW: 25, zip: 250 },
    L: { w: 340, h: 200, d: 100, strapLen: 1400, strapW: 25, zip: 300 },
  },
  sizeNote: { S: 'スマホと小さな財布', M: '長財布・ハンカチ・水', L: '折りたたみ傘や上着も' },

  shape(p) {
    return {
      family: 'halfmoon', w: p.w, h: p.h, d: p.d, corner: 0,
      flap: null, closure: 'zip', zip: 'top',
      handles: [{ type: 'cross', len: p.strapLen, width: p.strapW }],
      pocket: null,
    };
  },

  pieces(p) {
    const { w, h, d } = p;
    const side = halfmoonOutline(w, h);
    const iR = idx(side, [w, 10]), iL = idx(side, [0, 10]);
    const Lt = edgeLength(side, iL, iR);    // 上の辺(丸みもふくむ)= 上マチの長さ
    const Lb = edgeLength(side, iR, iL);    // 下の曲線 = 下マチの長さ
    const gw = d / 2 - 5;                   // 上マチ1枚のできあがり幅(ファスナーのむしまで 5mm あける)
    return [
      {
        id: 'side', name: '本体(前・後ろ)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: side, seam: 10, fold: null,
        grain: [[w / 2, h * 0.12], [w / 2, h * 0.42]],
        labelAt: [w / 2, h * 0.6],
        marks: [
          { type: 'notch', at: [w / 2, 0] }, { type: 'notch', at: [w / 2, h] },
          { type: 'notch', at: [w, 10] }, { type: 'notch', at: [0, 10] },
          { type: 'text', at: [w / 2, 8], text: '↑上マチ(ファスナー)を付ける辺', size: 3 },
          { type: 'text', at: [w * 0.8, 20], text: '◀上マチと下マチのつなぎ目', size: 2.6, anchor: 'end' },
          { type: 'text', at: [w / 2, h - 12], text: '曲線は縫い代に切りこみを入れる', size: 2.8 },
        ],
        _i: { iR, iL },
      },
      {
        id: 'zipgusset', name: 'ファスナーマチ(上)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        outline: rect(Lt, gw), seam: 10, fold: null,
        grain: [[Lt * 0.2, gw / 2], [Lt * 0.8, gw / 2]],
        labelAt: [Lt / 2, gw / 2 + 2],
        marks: [
          { type: 'notch', at: [Lt / 2, gw] }, { type: 'notch', at: [Lt / 2, 0] },
          { type: 'text', at: [Lt * 0.25, -5], text: '↑ファスナーがわ(縫い代を裏に折る)', size: 2.4 },
        ],
      },
      {
        id: 'gusset', name: 'マチ(下の帯)', cut: 1, fabric: 'outer', unit: '枚', more: [{ fabric: 'lining', cut: 1 }],
        outline: rect(d + 20, Lb + 20), seam: 0, fold: null, measureOnly: true,
        fin: { len: Lb, w: d },
        grain: [[(d + 20) / 2, 30], [(d + 20) / 2, Lb - 10]],
        marks: [],
        note: `縫い代こみの大きさ。長さのまん中(はしから${cmText(r5((Lb + 20) / 2))}cm)に印をつけ、本体の底の合い印に合わせる`,
      },
      tabPiece({ finW: p.strapW - 5, len: 60 }),
    ];
  },

  matches(p) {
    const s = this.pieces(p).find((x) => x.id === 'side')._i;
    return [
      { label: '上マチの長さ と 本体の上の辺', a: { piece: 'zipgusset', from: 0, to: 1 }, b: { piece: 'side', from: s.iL, to: s.iR }, tol: 0.5 },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体とファスナーマチを、表布と裏布で2枚ずつ', { more: '下のマチ(表布と裏布で1枚ずつ)とDカン通し2本は、布に線を引いて切ります。' }),
      markStep(['合い印(▲)', '上マチと下マチのつなぎ目']),
      '本体(表布)の裏に、接着芯をアイロンではります。',
      'ファスナーマチ(表布)の、ファスナーがわの縫い代1cmを裏に折ります。',
      `ファスナー(${p.zip / 10}cm)の両がわにファスナーマチを1枚ずつ重ね、ファスナーの歯(むし)から5mm離して縫います(上マチ)。`,
      `Dカン通しを四つ折りにして縫い、Dカン(${p.strapW}mm)を通して二つ折りにします。`,
      '上マチと下マチの両はしを、Dカン通しをはさんで縫い、輪にします。',
      '輪のマチと前の本体を、表どうしを内側にして重ね、合い印をそろえて縫います。曲線は縫い代に切りこみを入れます。',
      'ファスナーを半分あけてから、後ろの本体も同じように縫い、表に返します。',
      '裏布も、本体2枚・ファスナーマチ2枚・下マチで同じように組みます。ファスナーはつけず、ファスナーがわの縫い代は裏に折ります。',
      '裏袋を表袋の中に入れ、ファスナーのきわにまつり縫いでとめます。Dカンにひもを付けたら、できあがりです。',
    ];
  },

  extras(p) {
    const tape = { S: 1300, M: 1400, L: 1500 }[p.key] || p.strapLen + 100;
    return [
      `ファスナー${p.zip / 10}cm 1本`,
      `Dカン${p.strapW}mm 2個`,
      `ナスカン${p.strapW}mm 2個`,
      `送りカン${p.strapW}mm 1個`,
      `テープ${p.strapW}mm幅×${cmText(tape)}cm(または市販のひも)`,
    ];
  },
};

// ④ ふたつきポシェット(つまみマチ・丸いふた・マグネット・肩ひも)
export const shPochette = {
  id: 'sh-pochette',
  name: 'ふたつきポシェット',
  group: 'shoulder',
  level: 2,
  trend: false,
  desc: '丸いふたがついた、上品な小さいバッグ。小さなマチで財布も入ります。',
  sizes: {
    S: { w: 180, h: 140, d: 30, flapH: 85, strapLen: 1100, strapW: 20 },
    M: { w: 220, h: 170, d: 40, flapH: 100, strapLen: 1200, strapW: 25 },
    L: { w: 260, h: 200, d: 50, flapH: 120, strapLen: 1300, strapW: 25 },
  },
  sizeNote: { S: 'スマホ・カード・口紅', M: '財布・スマホ・ハンカチ', L: '長財布と老眼鏡も' },

  shape(p) {
    return {
      family: 'envelope', w: p.w, h: p.h, d: p.d, corner: 0,
      flap: { h: p.flapH, shape: 'round' }, closure: 'snap',
      handles: [{ type: 'shoulder', len: p.strapLen, width: p.strapW }],
      pocket: null,
    };
  },

  pieces(p) {
    const { w, h, d, flapH: f } = p;
    const W = w + d, c = d / 2, H = h + c, cx = W / 2;
    const R = Math.min(r5(f * 0.8), f - 5, w / 2 - 5);   // ふたの下の丸み
    // ふた: 時計まわり。上(本体に付ける辺)はまっすぐ、下の角が大きく丸い
    const flap = [[0, 0], [w, 0], ...arc(w - R, f - R, R, 0, 90, 16), ...arc(R, f - R, R, 90, 180, 16)];
    const fy = f - d - 20;     // 前のマグネット(ふたはマチの厚みぶん上をまわってから前にかかる)
    const strap = longStrap(p);
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: boxFoldOutline(W, H, c), seam: 10, fold: 'bottom',
        grain: [[W * 0.12, H * 0.25], [W * 0.12, H * 0.62]],
        labelAt: [cx, H * 0.55],
        marks: [
          { type: 'notch', at: [cx - w / 2, 0] }, { type: 'notch', at: [cx + w / 2, 0] },
          { type: 'notch', at: [cx, 0] },
          { type: 'text', at: [cx, 9], text: '後ろ:▲と▲の間にふたを付ける', size: 2.8 },
          { type: 'dot', at: [cx, fy], label: '(前だけ)マグネット凹' },
          { type: 'text', at: [W - c / 2, H - c / 2 + 1], text: 'マチ', size: 3.4 },
          { type: 'text', at: [c / 2, H - c / 2 + 1], text: 'マチ', size: 3.4 },
          { type: 'text', at: [cx, H - c - 20], text: '裏布は、片方のわきに返し口10cm', size: 2.8 },
          { type: 'text', at: [cx, H - c - 12], text: 'ひものはしは、両わきの口に付ける', size: 2.8 },
        ],
      },
      {
        id: 'flap', name: 'ふた', cut: 2, fabric: 'outer', more: [{ fabric: 'interfacing', cut: 1 }],
        outline: flap, seam: 10, fold: null,
        grain: [[w * 0.2, f * 0.15], [w * 0.2, f * 0.55]],
        labelAt: [w / 2, f * 0.4],
        marks: [
          { type: 'notch', at: [w / 2, 0] },
          { type: 'dot', at: [w / 2, f - 20], label: '(裏になる1枚)マグネット凸' },
          { type: 'text', at: [w / 2, 8], text: '↑本体に付ける辺(ここは縫わずにあけておく)', size: 2.6 },
        ],
      },
      strap,
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
      { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 3, to: 4 } },
      { label: 'ふたの左右の辺', a: { piece: 'flap', from: 1, to: 2 }, b: { piece: 'flap', from: -1, to: 0 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体の表布と裏布を1枚ずつ', { fold: true, more: 'ふたは表布で2枚切ります。' }),
      markStep(['合い印(▲)', 'マグネットの付け位置(●)']),
      '接着芯は、本体1枚とふた1枚を切り、表布の本体と、表になるふたの裏にアイロンではります。',
      `ひもは布に線を引いて2本切り、はしを縫いつないで1本にします。四つ折りにして縫います(できあがり幅${cmText(p.strapW)}cm)。`,
      'ふたの裏になる1枚にマグネットの凸を、本体の前の印に凹を付けます。',
      'ふた2枚を表どうしを内側にして重ね、上の辺を残してまわりを縫います。丸い所に切りこみを入れて、表に返します。',
      `本体を表どうしを内側にして底で折り、両わきを縫います。底の角を広げてまっすぐ縫い、マチ(${cmText(p.d)}cm)を作ります。`,
      '裏布も同じように縫います。片方のわきに、返し口10cmを縫わずに残します。',
      '表袋を表に返し、後ろの口のまん中にふたを、両わきの口にひものはしを、下向きにたらして仮どめします(ねじれないように)。',
      MOUTH,
      finish(5),
    ];
  },

  extras() { return ['マグネットボタン(さしこみ式)1組']; },
};

// ⑤ ミニボストン(本体1枚で前・底・後ろをくるむ・横2枚・上はファスナー・持ち手2本・Dカン)
// 横(両はし)は、上の角が大きく丸い形。本体のはし = 横のまわり − ファスナーのすき間 1cm。
const ZIP_STOCK = [12, 15, 18, 20, 25, 30, 40, 50, 60];
const zipFor = (w) => ZIP_STOCK.filter((z) => z * 10 <= w).pop() || 12;  // 口の長さより長くないもの

// 横の上の角は大きく丸く(ボストンらしい形)、下の角は小さく丸く。
// rt 上の角の丸み(高さの4割ほど・70〜80mm。横の幅が足りないときは 幅の半分 − 5mm まで)、rb 下の角の丸み
const BOSTON_RB = 30;
const bostonTop = (p) => Math.min(r5(p.h * 0.4), 80, p.d / 2 - 5);

function bostonEnd(d, h, rt, rb) {
  const g = 5; // ファスナーのすき間の半分
  const pts = [];
  if (d - rt > d / 2 + g + 0.5) pts.push([d / 2 + g, 0]);   // 上のまっすぐな所があるときだけ
  pts.push(
    ...arc(d - rt, rt, rt, 270, 360, 18),
    ...arc(d - rb, h - rb, rb, 0, 90, 12),
    [d / 2, h],
    ...arc(rb, h - rb, rb, 90, 180, 12),
    ...arc(rt, rt, rt, 180, 270, 18),
  );
  if (rt < d / 2 - g - 0.5) pts.push([d / 2 - g, 0]);
  return pts;
}

export const shBoston = {
  id: 'sh-boston',
  name: 'ミニボストン',
  group: 'shoulder',
  level: 3,
  trend: true,
  desc: 'ころんとした筒の形で、上はファスナー。手さげにも肩かけにもなります。',
  sizes: {
    S: { w: 260, h: 160, d: 140, handleLen: 300, handleW: 25, strapLen: 1100, strapW: 20 },
    M: { w: 320, h: 200, d: 160, handleLen: 350, handleW: 25, strapLen: 1200, strapW: 25 },
    L: { w: 400, h: 240, d: 180, handleLen: 400, handleW: 30, strapLen: 1300, strapW: 25 },
  },
  sizeNote: { S: 'お財布・ポーチ・水', M: 'おでかけの荷物ひとそろい', L: '1泊の小旅行に' },

  shape(p) {
    return {
      family: 'gusset', w: p.w, h: p.h, d: p.d, corner: bostonTop(p),
      flap: null, closure: 'zip', zip: 'top', bottom: 'flat',
      handles: [
        { type: 'loop', len: p.handleLen, width: p.handleW },
        { type: 'loop', len: p.handleLen, width: p.handleW },
        { type: 'shoulder', len: p.strapLen, width: p.strapW },
      ],
      strapAt: r5(p.w * 0.2), pocket: null,
    };
  },

  pieces(p) {
    const { w, h, d } = p, rt = bostonTop(p), rb = BOSTON_RB, hw = p.handleW;
    const end = bostonEnd(d, h, rt, rb);
    const iTop = idx(end, [d / 2 + 5, 0]), iBot = idx(end, [d / 2, h]), iTop2 = idx(end, [d / 2 - 5, 0]);
    const Lh = edgeLength(end, iTop, iBot);         // 本体の半分(ファスナーの辺 → 底のまん中)= 横のまわりの半分
    const qt = (Math.PI * rt) / 2, qb = (Math.PI * rb) / 2;   // 上の角・下の角の丸み1つぶんの長さ
    const top = Math.max(0, d / 2 - 5 - rt);         // 上のまっすぐな所
    const yT = top + qt / 2;                         // 上の角のまん中
    const yB = Lh - (d / 2 - rb) - qb / 2;           // 下の角のまん中
    const off = r5(w * 0.2);
    const hy = Math.round(top + qt) + 10;            // 持ち手のはしを付ける所(上の角のすぐ下)
    const st = Math.SQRT1_2 * rt, sb = Math.SQRT1_2 * rb;
    const zip = zipFor(w);
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: rect(w, Lh), seam: 10, fold: 'bottom',
        grain: [[w * 0.1, Lh * 0.45], [w * 0.1, Lh * 0.85]],
        labelAt: [w / 2, hy + 30 + (Lh - hy - 30) * 0.5],
        marks: [
          { type: 'text', at: [w / 2, 8], text: `↑ファスナー(${zip}cm)を付ける辺`, size: 3 },
          { type: 'notch', at: [w / 2, 0] },
          { type: 'notch', at: [0, yT] }, { type: 'notch', at: [w, yT] },
          { type: 'notch', at: [0, yB] }, { type: 'notch', at: [w, yB] },
          placeBox(w / 2 - off - hw / 2, hy, hw, 30, ''),
          placeBox(w / 2 + off - hw / 2, hy, hw, 30, ''),
          { type: 'text', at: [w / 2, hy + 15], text: '◀持ち手付け位置(四角とバツに縫う)▶', size: 2.6 },
          { type: 'text', at: [w / 2, Lh - 10], text: '両はしの合い印を、横の角の合い印に合わせる', size: 2.6 },
        ],
      },
      {
        id: 'end', name: '横(両はし)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: end, seam: 10, fold: null,
        grain: [[d * 0.2, h * 0.3], [d * 0.2, h * 0.7]],
        labelAt: [d / 2, h * 0.55],
        marks: [
          { type: 'notch', at: [d / 2, 0] }, { type: 'notch', at: [d / 2, h] },
          { type: 'notch', at: [d - rt + st, rt - st] }, { type: 'notch', at: [rt - st, rt - st] },
          { type: 'notch', at: [d - rb + sb, h - rb + sb] }, { type: 'notch', at: [rb - sb, h - rb + sb] },
          { type: 'text', at: [d / 2, 9], text: '↑Dカン通しをはさむ', size: 2.8 },
          { type: 'text', at: [d / 2, h - 10], text: '曲線は縫い代に切りこみ', size: 2.6 },
        ],
        _i: { iTop, iBot, iTop2 },
      },
      strapPiece({ finLen: p.handleLen, finW: hw, tuck: 30 }),
      tabPiece({ finW: 20, len: 60 }),
    ];
  },

  matches(p) {
    const e = this.pieces(p).find((x) => x.id === 'end')._i;
    return [
      { label: '本体の右はし と 横のまわり(半分)', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'end', from: e.iTop, to: e.iBot }, tol: 0.5 },
      { label: '本体の左はし と 横のまわり(半分)', a: { piece: 'body', from: 3, to: 0 }, b: { piece: 'end', from: e.iBot, to: e.iTop2 }, tol: 0.5 },
    ];
  },

  steps(p) {
    const zip = zipFor(p.w);
    return [
      PRINT,
      cutStep('本体を表布と裏布で1枚ずつ', { fold: true, more: '横は、表布と裏布で2枚ずつ切ります。' }),
      markStep(['合い印(▲)', '持ち手の付け位置(四角)']),
      '本体と横(表布)の裏に、厚めの接着芯をアイロンではります。',
      `持ち手は布に線を引いて2本切り、四つ折りにして縫います(できあがり幅${cmText(p.handleW)}cm)。本体の印に重ね、四角とバツに縫いつけます。`,
      `本体の口(上の辺)の両はしに、ファスナー(${zip}cm)を表どうしを内側にして重ねて縫い、筒にします。`,
      'Dカン通しは布に線を引いて2本切り、四つ折りにして縫います。Dカンを通して二つ折りにします。',
      'ファスナーを半分あけておきます(あとで表に返すため。大事です)。',
      '横の上のまん中にDカン通しをはさみ、合い印をそろえて、本体の両はしに縫います。曲線の縫い代に切りこみを入れて、表に返します。',
      '裏布の本体は、口の縫い代1cmを裏に折っておきます(ファスナーは付けません)。',
      '裏布の本体に、横2枚を同じように縫います。',
      '裏袋を表袋の中に入れ、ファスナーのきわにまつり縫いでとめます。Dカンに肩ひもを付けたら、できあがりです。',
    ];
  },

  extras(p) {
    const zip = zipFor(p.w);
    const list = [
      `ファスナー${zip}cm 1本(樹脂ファスナーがよい)`,
      `Dカン${p.strapW}mm 2個`,
      `ナスカン${p.strapW}mm 2個`,
      `肩ひも${cmText(p.strapLen)}cm(市販でもよい)`,
    ];
    if (p.key === 'L') list.push(`底板(あれば)${cmText(p.w - 20)}cm×${cmText(p.d - 20)}cm`);
    return list;
  },
};

export const SHOULDER_BAGS = [shPhone, shSacoche, shHalfmoon, shPochette, shBoston];

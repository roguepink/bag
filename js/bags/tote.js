// tote.js — トートバッグの仲間(型紙係)
import { rect, arc, edgeLength } from '../geom.js';
import { strapPiece, foldPocket, placeBox, r5, cmText } from './parts.js';

// ---------- このファイルで使う道具 ----------
// 持ち手の両はしの合い印(口の辺 y=0)。centers = 持ち手の中心の x
const handleNotches = (centers, hw) => centers.flatMap((x) => [
  { type: 'notch', at: [x - hw / 2, 0] }, { type: 'notch', at: [x + hw / 2, 0] },
]);

// 底を「わ」にした、つまみマチの本体(半分の型紙)。
// W = 型紙の幅(できあがりの よこ + マチ)、c = マチの半分、H = 口から わ まで
// 時計まわり: 左上 → 右上 → 右わき → 角の切りとり → わ(底のまん中) → 角 → 左わき
function boxFoldOutline(W, H, c) {
  return [[0, 0], [W, 0], [W, H - c], [W - c, H - c], [W - c, H], [c, H], [c, H - c], [0, H - c]];
}

// 柄の向きの注意(底を わ にした型紙に書く)
const DIR_NOTE = '柄に上下があるときは、底で2枚に分けて切り、底にも縫い代1cmを足す';

// ① ぺたんこトート(マチなし・底は わ・まっすぐ縫うだけ)
export const toteFlat = {
  id: 'tote-flat',
  name: 'ぺたんこトート',
  group: 'tote',
  level: 1,
  trend: true,
  desc: 'マチのない、うすくて平らなトート。まっすぐ縫うだけで作れます。',
  sizes: {
    S: { w: 250, h: 250, d: 0, handleLen: 300, handleW: 20 },
    M: { w: 330, h: 380, d: 0, handleLen: 400, handleW: 25 },
    L: { w: 400, h: 420, d: 0, handleLen: 550, handleW: 30 },
  },
  sizeNote: { S: '本や財布が入る', M: 'A4の書類が入る', L: '肩にかけられる・雑誌も入る' },

  shape(p) {
    const at = r5(p.w * 0.25);
    return {
      family: 'flat', w: p.w, h: p.h, d: 0, corner: 0,
      flap: null, closure: null,
      handles: [
        { type: 'loop', len: p.handleLen, width: p.handleW },
        { type: 'loop', len: p.handleLen, width: p.handleW },
      ],
      strapAt: p.w / 2 - at - p.handleW / 2,
      pocket: { w: r5(p.w * 0.5), h: r5(p.h * 0.4), side: 'front' },
    };
  },

  pieces(p) {
    const { w, h } = p, hw = p.handleW;
    const at = r5(w * 0.25);                       // 口のはしから持ち手まで
    const pw = r5(w * 0.5), ph = r5(h * 0.4);
    const py = r5(h * 0.28);
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: rect(w, h), seam: 10, fold: 'bottom',
        grain: [[w * 0.12, h * 0.2], [w * 0.12, h * 0.7]],
        labelAt: [w / 2, py + ph / 2],
        marks: [
          ...handleNotches([at + hw / 2, w - at - hw / 2], hw),
          { type: 'text', at: [w / 2, 9], text: '▲持ち手を付ける位置', size: 3.4 },
          placeBox((w - pw) / 2, py, pw, ph, '(表布の前だけ)外ポケット付け位置'),
          { type: 'text', at: [w / 2, h - 34], text: '裏布は、片方のわきに返し口12cm', size: 3 },
          { type: 'text', at: [w / 2, h - 26], text: '接着芯は、細い線(できあがり線)で切る', size: 3 },
          { type: 'text', at: [w / 2, h - 18], text: DIR_NOTE, size: 2.6 },
        ],
      },
      foldPocket({ id: 'pocket', name: '外ポケット', fabric: 'accent', pw, ph }),
      strapPiece({ finLen: p.handleLen, finW: hw, tuck: 30 }),
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 3, to: 0 } },
    ];
  },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '布を半分に折り、型紙の「わ」を折り山に合わせて、表布と裏布を1枚ずつ切ります。持ち手は布に線を引いて2本切ります。',
      '接着芯を使うときは、表布の裏にアイロンではります(なくても作れます)。',
      `持ち手を四つ折りにして、両はしを縫います(できあがり幅${cmText(p.handleW)}cm)。`,
      '外ポケットを「わ」で半分に折り、返し口を残してまわりを縫い、表に返します。',
      '外ポケットを表布の前の印に重ね、両わきと底を縫いつけます。',
      '表布を、表どうしが内側になるように底で折り、両わきを縫います。',
      '裏布も同じように縫います。片方のわきに返し口12cmを縫わずに残します。',
      '表布を表に返し、持ち手を▲の印に合わせて口に仮どめします(ねじれないように)。',
      '表布を裏布の中に入れ(表どうしが内側)、口をぐるりと縫います。',
      '返し口から引き出して表に返し、返し口を縫いとじます。',
      '口から5mm内側をぐるりと縫っておさえたら、できあがりです。',
    ];
  },

  extras() { return []; },
};

// ② まちつきトート(底の角を四角く切りとってマチを作る・持ち手2本・内ポケット・裏布つき)
// 本体は 表布2枚・裏布2枚(同じ型紙)。底で縫い合わせるので、柄の向きがそろう。
export const toteBasic = {
  id: 'tote-basic',
  name: 'まいにちトート',
  group: 'tote',
  level: 2,
  trend: true,
  desc: 'マチがあって たっぷり入る、裏布つきのトート。内ポケットつき。',
  sizes: {
    S: { w: 260, h: 220, d: 100, handle: 380, handleW: 25 },
    M: { w: 340, h: 300, d: 120, handle: 480, handleW: 30 },
    L: { w: 420, h: 360, d: 150, handle: 580, handleW: 30 },
  },
  sizeNote: { S: 'お弁当や小物に', M: 'A4のファイルが入る', L: '旅行や買い物に' },

  shape(p) {
    return {
      family: 'boxed', w: p.w, h: p.h, d: p.d, corner: 0,
      flap: null, closure: null,
      handles: [
        { type: 'loop', len: p.handle, width: p.handleW },
        { type: 'loop', len: p.handle, width: p.handleW },
      ],
      pocket: null,
    };
  },

  pieces(p) {
    const W = p.w + p.d;          // 型紙の幅(マチの分も)
    const c = p.d / 2;            // 角を切りとる四角
    const H = p.h + c;            // 型紙の高さ
    const cx = W / 2;
    const gap = r5(p.w * 0.3);    // 持ち手の内側どうしの間
    const pw = r5(p.w * 0.55), ph = r5(p.h * 0.45);
    const py = r5(Math.max(40, p.h * 0.17));
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        // 時計まわり: 上 → 右わき → 角の切りとり → 底 → 角 → 左わき
        outline: [[0, 0], [W, 0], [W, H - c], [W - c, H - c], [W - c, H], [c, H], [c, H - c], [0, H - c]],
        seam: 10, fold: null,
        grain: [[W * 0.14, H * 0.22], [W * 0.14, H * 0.72]],
        labelAt: [cx, H * 0.62],
        marks: [
          { type: 'notch', at: [cx - gap / 2, 0] }, { type: 'notch', at: [cx - gap / 2 - p.handleW, 0] },
          { type: 'notch', at: [cx + gap / 2, 0] }, { type: 'notch', at: [cx + gap / 2 + p.handleW, 0] },
          { type: 'text', at: [cx, 9], text: '▲ 持ち手を付ける位置' },
          { type: 'notch', at: [cx, H] },
          { type: 'dot', at: [cx, 20], label: 'マグネット(裏布)' },
          placeBox(cx - pw / 2, py, pw, ph, '(裏布だけ)内ポケット付け位置'),
          { type: 'text', at: [W - c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'text', at: [c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'text', at: [cx, H - 9], text: '裏布は 底に 返し口 12cm', size: 3 },
        ],
      },
      foldPocket({ pw, ph }),
      strapPiece({ finLen: p.handle, finW: p.handleW, tuck: 20 }),
    ];
  },

  // 縫い合わせる辺の長さが合うか(チェック用)
  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
      { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 3, to: 4 } },
    ];
  },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      `表布と裏布を、本体の型紙で 2枚ずつ切ります。持ち手は 布に線を引いて 2本切ります。`,
      `持ち手を 四つ折りにして、両はしを縫います(できあがり幅 ${cmText(p.handleW)}cm)。`,
      '内ポケットを わで半分に折り、返し口を残してまわりを縫い、表に返して 裏布1枚の印の所に縫いつけます。',
      '表布2枚を 表どうしを内側にして重ね、両わきと底を縫います。',
      `底の角の 四角く切った所を広げ、わきと底の縫い目を合わせて まっすぐ縫います(マチ ${cmText(p.d)}cm)。`,
      '裏布も同じように縫います。底に 返し口 12cm を縫わずに残します。',
      '表布を表に返し、持ち手を ▲の印に合わせて 口に仮どめします。',
      '表布を 裏布の中に入れ(表どうしが内側)、口をぐるりと縫います。',
      '返し口から ひっぱり出して表に返し、返し口を縫いとじます。',
      '口のまわりを ぐるりと縫って(ステッチ)、できあがりです。',
    ];
  },

  extras() {
    return ['マグネットボタン 1組(お好みで)', '接着芯(しっかりさせたいとき・お好みで)'];
  },
};

// つまみマチ・底わき の本体を作る(よこなが・くったり大きな で使う)
// o: { pocket: {pw,ph} | null, ret: 返し口 mm, interfacing: bool, handleOff: 中心から持ち手の中心まで }
function boxFoldBody(p, o) {
  const W = p.w + p.d, c = p.d / 2, H = p.h + c, cx = W / 2, hw = p.handleW;
  const marks = [
    ...handleNotches([cx - o.handleOff, cx + o.handleOff], hw),
    { type: 'text', at: [cx, 9], text: '▲持ち手を付ける位置', size: 3.4 },
    { type: 'notch', at: [cx, 0] },
    { type: 'text', at: [W - c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
    { type: 'text', at: [c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
    { type: 'text', at: [cx, H - c - 22], text: `裏布は、片方のわきに返し口${cmText(o.ret)}cm`, size: 3 },
    { type: 'text', at: [cx, H - c - 14], text: DIR_NOTE, size: 2.6 },
  ];
  if (o.magnet) marks.push({ type: 'dot', at: [cx, 20], label: 'マグネット(裏布・つけるなら)' });
  if (o.interfacing) marks.push({ type: 'text', at: [cx, H - c - 30], text: '接着芯は、細い線(できあがり線)で切る', size: 3 });
  if (o.pocket) {
    const { pw, ph } = o.pocket;
    const py = r5(Math.max(40, p.h * 0.17));
    marks.push(placeBox(cx - pw / 2, py, pw, ph, '(裏布の片がわだけ)内ポケット付け位置'));
  }
  const more = [{ fabric: 'lining', cut: 1 }];
  if (o.interfacing) more.push({ fabric: 'interfacing', cut: 1 });
  return {
    id: 'body', name: '本体', cut: 1, fabric: 'outer', more,
    outline: boxFoldOutline(W, H, c), seam: 10, fold: 'bottom',
    grain: [[W * 0.12, H * 0.2], [W * 0.12, H * 0.62]],
    labelAt: [cx, o.pocket ? r5(Math.max(40, p.h * 0.17)) + o.pocket.ph + 40 : H * 0.5],
    marks,
  };
}

const BOX_MATCHES = [
  { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
  { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 3, to: 4 } },
];

// ③ よこながトート(横長・背がひくい・つまみマチ・接着芯)
export const toteYokonaga = {
  id: 'tote-yokonaga',
  name: 'よこながトート',
  group: 'tote',
  level: 1,
  trend: true,
  desc: '横に長くて背のひくい、すっきりした形。いま人気の形です。',
  sizes: {
    S: { w: 320, h: 180, d: 80, handleLen: 350, handleW: 20 },
    M: { w: 420, h: 240, d: 100, handleLen: 450, handleW: 25 },
    L: { w: 500, h: 280, d: 120, handleLen: 500, handleW: 25 },
  },
  sizeNote: { S: '長財布とスマホが入る', M: 'A4を横にして入る', L: 'ひざかけや上着も入る' },

  shape(p) {
    return {
      family: 'boxed', w: p.w, h: p.h, d: p.d, corner: 0,
      flap: null, closure: null,
      handles: [
        { type: 'loop', len: p.handleLen, width: p.handleW },
        { type: 'loop', len: p.handleLen, width: p.handleW },
      ],
      strapAt: r5(p.w * 0.2), pocket: null,
    };
  },

  pieces(p) {
    return [
      boxFoldBody(p, { ret: 120, interfacing: true, magnet: true, handleOff: r5(p.w * 0.2), pocket: null }),
      strapPiece({ finLen: p.handleLen, finW: p.handleW, tuck: 30 }),
    ];
  },

  matches() { return BOX_MATCHES; },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '布を半分に折り、「わ」を折り山に合わせて、表布・裏布・接着芯を1枚ずつ切ります。持ち手は布に線を引いて2本切ります。',
      '表布の裏に、接着芯をアイロンではります。',
      `持ち手を四つ折りにして、両はしを縫います(できあがり幅${cmText(p.handleW)}cm)。`,
      '表布を、表どうしが内側になるように底で折り、両わきを縫います。',
      `底の角の四角く切った所を広げ、わきの縫い目と底の折り山を合わせて、まっすぐ縫います(マチ${cmText(p.d)}cm)。`,
      '裏布も同じように縫います。片方のわきに返し口12cmを縫わずに残します。',
      '表布を表に返し、持ち手を▲の印に合わせて口に仮どめします。',
      '表布を裏布の中に入れ(表どうしが内側)、口をぐるりと縫います。',
      '返し口から表に返して返し口を縫いとじ、口から5mm内側を縫っておさえたら、できあがりです。',
    ];
  },

  extras() { return ['マグネットボタン1組(つけるなら)']; },
};

// ④ くったり大きなトート(大きい・やわらかい・肩かけ・内ポケット・芯なし)
export const toteBig = {
  id: 'tote-big',
  name: 'くったり大きなトート',
  group: 'tote',
  level: 1,
  trend: true,
  desc: '大きくて、やわらかくくったりした形。肩にかけてたくさん運べます。',
  sizes: {
    S: { w: 420, h: 360, d: 120, handleLen: 550, handleW: 30 },
    M: { w: 480, h: 400, d: 150, handleLen: 600, handleW: 35 },
    L: { w: 560, h: 440, d: 180, handleLen: 650, handleW: 40 },
  },
  sizeNote: { S: 'A4とお弁当が入る', M: '1泊旅行の荷物が入る', L: 'ふとんカバーや洗たく物も運べる' },

  shape(p) {
    return {
      family: 'boxed', w: p.w, h: p.h, d: p.d, corner: 0, soft: true,
      flap: null, closure: null,
      handles: [
        { type: 'shoulder', len: p.handleLen, width: p.handleW },
        { type: 'shoulder', len: p.handleLen, width: p.handleW },
      ],
      strapAt: r5(p.w * 0.22), pocket: null,
    };
  },

  pieces(p) {
    const pw = 200, ph = 180;
    return [
      boxFoldBody(p, { ret: 150, interfacing: false, magnet: false, handleOff: r5(p.w * 0.22), pocket: { pw, ph } }),
      foldPocket({ id: 'inpocket', pw, ph }),
      strapPiece({ finLen: p.handleLen, finW: p.handleW, tuck: 30 }),
    ];
  },

  matches() { return BOX_MATCHES; },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '布を半分に折り、「わ」を折り山に合わせて、表布と裏布を1枚ずつ切ります。持ち手は布に線を引いて2本切ります。',
      `持ち手を四つ折りにして、両はしを縫います(できあがり幅${cmText(p.handleW)}cm)。太いので2本線で縫うと丈夫です。`,
      '内ポケットを「わ」で半分に折り、返し口を残して縫い、表に返して、裏布の印の所に縫いつけます。',
      '表布を、表どうしが内側になるように底で折り、両わきを縫います。',
      `底の角の四角く切った所を広げ、わきの縫い目と底の折り山を合わせて、まっすぐ縫います(マチ${cmText(p.d)}cm)。`,
      '裏布も同じように縫います。片方のわきに返し口15cmを縫わずに残します。',
      '表布を表に返し、持ち手を▲の印に合わせて口に仮どめします。',
      '表布を裏布の中に入れ(表どうしが内側)、口をぐるりと縫います。',
      '返し口から表に返して、返し口を縫いとじます。',
      '口から5mm内側を縫っておさえ、持ち手のつけ根を四角とバツに縫って丈夫にしたら、できあがりです。',
    ];
  },

  extras() { return []; },
};

// ⑤ はこ型トート(前・後ろの本体に、横と底をつなぐ1本の帯のマチ・外ポケット・マグネット)
export const toteBox = {
  id: 'tote-box',
  name: 'はこ型トート',
  group: 'tote',
  level: 3,
  trend: false,
  desc: '横と底に1本の帯(マチ)をつけた、四角くしっかりしたトート。',
  sizes: {
    S: { w: 260, h: 220, d: 120, handleLen: 350, handleW: 25 },
    M: { w: 340, h: 280, d: 140, handleLen: 400, handleW: 25 },
    L: { w: 400, h: 320, d: 160, handleLen: 500, handleW: 30 },
  },
  sizeNote: { S: 'お弁当箱がまっすぐ入る', M: 'A4のファイルが入る', L: '手芸道具や作品の持ち運びに' },

  shape(p) {
    return {
      family: 'gusset', w: p.w, h: p.h, d: p.d, corner: 10,
      flap: null, closure: 'snap',
      handles: [
        { type: 'loop', len: p.handleLen, width: p.handleW },
        { type: 'loop', len: p.handleLen, width: p.handleW },
      ],
      strapAt: r5(p.w * 0.22),
      pocket: { w: r5(p.w * 0.7), h: r5(p.h * 0.5), side: 'front' },
    };
  },

  pieces(p) {
    const { w, h, d } = p, r = 10, hw = p.handleW;
    // 時計まわり: 左上 → 右上 → 右わき → 右下の丸 → 底 → 左下の丸 → 左わき
    const panel = [[0, 0], [w, 0], ...arc(w - r, h - r, r, 0, 90, 8), ...arc(r, h - r, r, 90, 180, 8)];
    const Lg = edgeLength(panel, 1, 0);           // 本体の わき・底・わき の長さ = マチの帯の長さ
    const pw = r5(w * 0.7), ph = r5(h * 0.5), py = r5(h * 0.25);
    const off = r5(w * 0.22);
    const s45 = Math.SQRT1_2 * r;
    const cornerAt = 10 + (h - r) + (Math.PI * r) / 4;  // マチのはしから 角のまん中まで(縫い代こみ)
    return [
      {
        id: 'front', name: '本体(前・後ろ)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: panel, seam: 10, fold: null,
        grain: [[w * 0.1, h * 0.2], [w * 0.1, h * 0.7]],
        labelAt: [w / 2, py + ph / 2],
        marks: [
          ...handleNotches([w / 2 - off, w / 2 + off], hw),
          { type: 'text', at: [w / 2, 9], text: '▲持ち手を付ける位置', size: 3.4 },
          { type: 'dot', at: [w / 2, 22], label: 'マグネット(裏布)' },
          { type: 'notch', at: [w / 2, h] },
          { type: 'notch', at: [w - r + s45, h - r + s45] }, { type: 'notch', at: [r - s45, h - r + s45] },
          placeBox((w - pw) / 2, py, pw, ph, '(表布の前だけ)外ポケット付け位置'),
          { type: 'text', at: [w / 2, h - 12], text: '底の合い印をマチのまん中に、角の合い印をマチの角の印に合わせる', size: 2.8 },
        ],
      },
      {
        id: 'gusset', name: 'マチ(横と底の帯)', cut: 1, fabric: 'outer', unit: '枚',
        more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: rect(d + 20, Lg + 20), seam: 0, fold: null, measureOnly: true,
        fin: { len: Lg, w: d },
        grain: [[(d + 20) / 2, 40], [(d + 20) / 2, Lg - 20]],
        marks: [],
        note: `縫い代こみの大きさ。まん中(はしから${cmText(r5((Lg + 20) / 2))}cm)と、両はしから${cmText(Math.round(cornerAt))}cmの所(底の角)に印をつける。裏布のマチは底に返し口12cm`,
      },
      foldPocket({ id: 'pocket', name: '外ポケット', fabric: 'accent', pw, ph }),
      strapPiece({ finLen: p.handleLen, finW: hw, tuck: 30 }),
    ];
  },

  matches(p) {
    return [
      { label: '左わき と 右わき', a: { piece: 'front', from: 1, to: 2 }, b: { piece: 'front', from: -1, to: 0 } },
    ];
  },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。マチと持ち手は、布に線を引いて切ります。',
      '本体とマチの裏に、厚めの接着芯をアイロンではります(芯はまわりの縫い代1cmをのぞいた大きさ)。',
      'マグネットボタンを、裏布の本体2枚の口の印につけます。',
      '外ポケットを「わ」で半分に折って縫い、表に返して、前の本体の印に縫いつけます。',
      `持ち手を四つ折りにして、両はしを縫います(できあがり幅${cmText(p.handleW)}cm)。`,
      '前の本体とマチを表どうしで重ね、底のまん中と角の合い印をそろえて、わき・底・わきと縫います。角は縫い代に切りこみを入れます。',
      'マチの反対がわに、後ろの本体を同じように縫います。',
      '裏布も同じように組み立てます。マチの底に返し口12cmを残します。',
      '表袋を表に返し、持ち手を▲の印に合わせて口に仮どめします。',
      '表袋を裏袋の中に入れて(表どうしが内側)、口をぐるりと縫います。',
      '返し口から表に返して返し口をとじ、口から5mm内側を縫っておさえたら、できあがりです。',
    ];
  },

  extras(p) {
    return ['マグネットボタン1組', `底板(あれば)${cmText(p.w - 20)}cm×${cmText(p.d - 20)}cm`];
  },
};

export const TOTE_BAGS = [toteFlat, toteBasic, toteYokonaga, toteBig, toteBox];

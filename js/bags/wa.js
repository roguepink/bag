// wa.js — 和の袋の仲間(型紙係)
// 計画 data/bags-plan.json の wa 5種類。単位 mm、できあがり線で作る(縫い代は seam で足す)。
// sizes の w・h・d は「できあがり」の寸法(マチつきは 前の面の幅)。
import { rect, circle } from '../geom.js';
import { strapPiece, cmText, r5 } from './parts.js';
import { PRINT, cutStep, markStep, lineCut, strapSew, zigzag, tackStep, OUT, MOUTH, TURN } from './steps-common.js';

// ---------- この仲間で使う道具 ----------

// 説明の文字。線の印(長さほぼ 0)のラベルとして書くと、型紙が 90°回されて並んでも 文字が いっしょに回る。
function note(at, text, vertical = false) {
  return { type: 'line', pts: [at, vertical ? [at[0], at[1] + 0.01] : [at[0] + 0.01, at[1]]], label: text };
}

// 底の角を四角く切りとった形(つまみマチ)。点の番号は pouch.js と同じ:
// 0 左上 → 1 右上 → 2 右わきの下 → 3 角 → 4 底の右 → 5 底の左 → 6 角 → 7 左わきの下
function boxOutline(W, H, c) {
  return [[0, 0], [W, 0], [W, H - c], [W - c, H - c], [W - c, H], [c, H], [c, H - c], [0, H - c]];
}

const cord50 = (mm) => Math.ceil(mm / 50) * 50;

// 口の三つ折り(ひも通し)の印。W 幅、casing ひも通しの幅、stop あき止まり(口から)
function casingMarks(W, casing, stop, { sideDots = true } = {}) {
  const m = [
    { type: 'line', pts: [[0, -casing], [W, -casing]], label: '①ここで1cm折る' },
    note([W / 2, -casing / 2], `↓②下の線(できあがり線)で${cmText(casing)}cm折る(ひも通し)`),
  ];
  if (sideDots) {
    m.push(
      { type: 'dot', at: [0, stop] }, { type: 'dot', at: [W, stop] }, note([14, stop + 5], 'あき止まり'),
      { type: 'notch', at: [0, stop] }, { type: 'notch', at: [W, stop] },
      note([W / 2, stop - 7], 'わきは口からあき止まりまで縫わない'),
    );
  }
  return m;
}

// 裏布は 表布と同じ型紙で、口だけ この線で切る(ひも通しの幅だけ短く)
function liningTopMarks(W, casing) {
  const y = casing - 10;
  return [
    { type: 'line', pts: [[0, y], [W, y]] },
    note([W / 2, y + 5], '↑裏布はこの点線で切る(口)'),
  ];
}

// ---------- ① きほんの巾着 ----------
// 長方形1枚を 底で わ に折る。両わきを縫って、口を三つ折りにして ひもを通すだけ。
export const waKinchaku = {
  id: 'wa-kinchaku',
  name: 'きほんの巾着',
  group: 'wa',
  level: 1,
  trend: false,
  desc: 'ひもを引くと口がしまる、いちばん簡単な袋。まっすぐ縫うだけ。',
  sizes: {
    S: { w: 150, h: 180, d: 0, casing: 15, openStop: 50, cordW: 3 },
    M: { w: 220, h: 260, d: 0, casing: 20, openStop: 60, cordW: 4 },
    L: { w: 300, h: 350, d: 0, casing: 25, openStop: 70, cordW: 5 },
  },
  sizeNote: { S: '小物・お守り・小銭', M: 'コップ・おやつ・下着', L: '着がえ・くつ' },

  shape(p) {
    const cord = kinCord(p);
    return {
      family: 'gathered', w: p.w, h: p.h, d: 0, topW: r5(p.w * 0.35), corner: 0,
      flap: null, closure: 'drawstring',
      handles: [{ type: 'cord', len: cord, width: p.cordW }, { type: 'cord', len: cord, width: p.cordW }],
      pocket: null,
    };
  },

  pieces(p) {
    const { w, h } = p;
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer',
        outline: rect(w, h), seam: [p.casing + 10, 10, 10, 10], fold: 'bottom',
        grain: [[w * 0.12, h * 0.3], [w * 0.12, h * 0.8]],
        labelAt: [w / 2, h * 0.58],
        marks: [
          ...casingMarks(w, p.casing, p.openStop),
          { type: 'notch', at: [w / 2, 0] },
        ],
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
      `${zigzag('両わき')}わきは割るので、1枚ずつかけます。`,
      '表どうしを内側にして「わ」で半分に折り、両わきを、あき止まりから下まで縫います。',
      'わきの縫い代を、アイロンで割ります。',
      'あき止まりより上の縫い代を、コの字に縫いとめます。',
      `口を1cm折り、さらに${cmText(p.casing)}cm折って(三つ折り)、アイロンをかけます。`,
      '折った口の下のはしを、ぐるりと縫います(ひも通し)。',
      '表に返します。',
      `ひも(${cmText(kinCord(p))}cm)を1本、右のあきから入れて、ぐるりと通します。`,
      'もう1本を左のあきから同じように通し、それぞれのはしを結んだら、できあがりです。',
    ];
  },

  extras(p) {
    return [`丸ひも(太さ${p.cordW}mm) ${cmText(kinCord(p))}cm×2本`, 'ひも通し(安全ピンでもできます)'];
  },
};
// ひも1本: 口まわり(w×2) + 結ぶぶん 200mm
function kinCord(p) { return cord50(p.w * 2 + 200); }

// ---------- ② あずま袋 ----------
// 昔ながらの作り: 1:3 の長い布を 3つに分け、左を折って下を、右を折って上を縫う。
// 長方形だけなので 型紙は印刷せず、布に直接線を引く(measureOnly)。まわりは 5mm+1cm の三つ折り。
const AZ_HEM = 15;
export const waAzuma = {
  id: 'wa-azuma',
  name: 'あずま袋',
  group: 'wa',
  level: 1,
  trend: true,
  desc: '長い布を三つに折って、2か所縫うだけ。結んで持てて、たためばエコバッグに。',
  sizes: {
    S: { a: 200, w: 200, h: 200, d: 0 },
    M: { a: 280, w: 280, h: 280, d: 0 },
    L: { a: 330, w: 330, h: 330, d: 0 },
  },
  sizeNote: { S: 'お弁当包み・小物', M: '手ぬぐい1枚で作れる大きさ', L: 'お買いもの・ふろしき代わり' },
  sizeText: (p) => `布よこ${cmText(p.a * 3)}cm×たて${cmText(p.a)}cm(1:3)を三つに折る`,

  shape(p) {
    return {
      family: 'azuma', w: p.a, h: p.a, d: 0, corner: 0,
      flap: null, closure: 'tie',
      handles: [{ type: 'knot', len: 0, width: 0 }],
      pocket: null,
    };
  },

  pieces(p) {
    const a = p.a, e = AZ_HEM;
    const W = 3 * a + 2 * e, H = a + 2 * e;
    const x1 = e + a, x2 = e + 2 * a;
    return [
      {
        id: 'body', name: '本体(長い布)', cut: 1, fabric: 'outer', unit: '枚',
        // 点: 0 左上 → 1 区切り1 → 2 区切り2 → 3 右上 → 4 右下 → 5 区切り2 → 6 区切り1 → 7 左下
        outline: [[0, 0], [x1, 0], [x2, 0], [W, 0], [W, H], [x2, H], [x1, H], [0, H]],
        seam: 0, fold: null,
        grain: [[W * 0.1, H * 0.3], [W * 0.1, H * 0.7]],
        marks: [
          { type: 'line', pts: [[x1, 0], [x1, H]], label: '区切り' },
          { type: 'line', pts: [[x2, 0], [x2, H]], label: '区切り' },
        ],
        measureOnly: true,
        note: `まわりを5mm折り、さらに1cm折って縫う(三つ折り)と${cmText(3 * a)}cm×${cmText(a)}cm。よこをはしから${cmText(a)}cmずつ3つに分ける印をつけます。`,
      },
    ];
  },

  matches() {
    return [
      { label: '右の上 と 左の上(2つめに縫う所)', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 0, to: 1 } },
      { label: '左の下 と まん中の下(はじめに縫う所。はしの三つ折り 1.5cm をのぞくと同じ)', a: { piece: 'body', from: 6, to: 7 }, b: { piece: 'body', from: 5, to: 6 }, tol: AZ_HEM + 0.5 },
    ];
  },

  steps(p) {
    const a = p.a;
    return [
      `布に定規とチャコペンで、よこ${cmText(3 * a + 2 * AZ_HEM)}cm×たて${cmText(a + 2 * AZ_HEM)}cmの線を引きます(型紙は使いません)。`,
      '線にそって、布を切ります。',
      'まわりを5mm折り、さらに1cm折って縫います(三つ折り)。手ぬぐいなら、耳のある長い辺はそのままでよい。',
      `布を横長に置き、よこを${cmText(a)}cmずつ3つ(左・まん中・右)に分ける印をつけます。`,
      '表どうしを内側にして、左の1つ分をまん中に重ね、下の辺を2枚いっしょに縫います。',
      '右の1つ分をその上に重ね、上の辺を縫います。いちばん下の布は、いっしょに縫わないようによけます。',
      '縫いはじめと縫いおわりは、かえし縫いをして丈夫にします。',
      '表に返すと、袋になります。',
      'とがった2つの角を結んで持ち手にしたら、できあがりです。',
    ];
  },

  extras(p) {
    return p.key === 'M' ? ['手ぬぐい1枚(34cm×90cm)でも作れます(少し小さめになります)'] : ['なし(糸だけ)'];
  },
};

// ---------- ③ お弁当袋(マチつき巾着) ----------
export const waBento = {
  id: 'wa-bento',
  name: 'お弁当袋(マチつき巾着)',
  group: 'wa',
  level: 1,
  trend: false,
  desc: '底にマチがある巾着。お弁当箱が平らに入ります。',
  sizes: {
    S: { w: 180, h: 160, d: 100, casing: 20, openStop: 50, cordW: 4 },
    M: { w: 220, h: 200, d: 120, casing: 20, openStop: 60, cordW: 4 },
    L: { w: 260, h: 220, d: 140, casing: 25, openStop: 60, cordW: 5 },
  },
  sizeNote: { S: '小さいお弁当箱', M: 'ふつうのお弁当箱とおはし', L: '2段のお弁当箱・水筒' },

  shape(p) {
    const cord = bentoCord(p);
    return {
      family: 'gathered', w: p.w, h: p.h, d: p.d, topW: r5(p.w * 0.4), corner: 0,
      flap: null, closure: 'drawstring', bottom: 'flat',
      handles: [{ type: 'cord', len: cord, width: p.cordW }, { type: 'cord', len: cord, width: p.cordW }],
      pocket: null,
    };
  },

  pieces(p) {
    const W = p.w + p.d, c = p.d / 2, H = p.h + c, cx = W / 2;
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }],
        note: '裏布はなくてもよい。つけるとじょうぶで、ラミネート布ならよごれもふきやすい。',
        outline: boxOutline(W, H, c), seam: [p.casing + 10, 10, 10, 10, 10, 10, 10, 10], fold: 'bottom',
        grain: [[W * 0.1, H * 0.3], [W * 0.1, H * 0.7]],
        labelAt: [cx, H * 0.55],
        marks: [
          ...casingMarks(W, p.casing, p.openStop),
          ...liningTopMarks(W, p.casing),
          { type: 'notch', at: [cx, 0] },
          note([W - c / 2, H - c / 2 + 1], 'マチ'),
          note([c / 2, H - c / 2 + 1], 'マチ'),
        ],
      },
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
      { label: 'マチの角(よこ2つ と たて)', a: { piece: 'body', from: 2, to: 3, times: 2 }, b: { piece: 'body', from: 3, to: 4, times: 2 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体を1枚', { fold: true }),
      '裏布をつけるときは、同じ型紙で切ります。ただし口は、型紙の点線の所で切ります(表布より短くなります)。',
      markStep(['合い印(▲)', 'あき止まり(●)', '口の折り線']),
      `${zigzag('両わき')}わきは割るので、1枚ずつかけます。`,
      '表どうしを内側にして「わ」で折り、両わきを、あき止まりから下まで縫います。',
      'わきの縫い代を、アイロンで割ります。',
      'あき止まりより上の縫い代を、コの字に縫いとめます。',
      `底の角の四角く切った所を広げ、わきの縫い目と底の折り山を合わせて、まっすぐ縫います(マチ${cmText(p.d)}cm)。`,
      'マチの縫い代にも、ジグザグミシンをかけます。',
      '裏布をつけるときは、裏布も両わきと底の角を縫います。',
      '裏布をつけるときは、表袋を表に返して、裏袋を裏が外のまま中に入れます。',
      `口を1cm折り、さらに${cmText(p.casing)}cm折って(裏布の口もはさむ)、下のはしをぐるりと縫います(ひも通し)。`,
      '裏布なしのときは、ここで表に返します。',
      `ひも(${cmText(bentoCord(p))}cm)を左右から1本ずつ通し、はしを結んだら、できあがりです。`,
    ];
  },

  extras(p) {
    return [`丸ひも(太さ${p.cordW}mm) ${cmText(bentoCord(p))}cm×2本`, 'ひも通し(安全ピンでもできます)'];
  },
};
// マチがあるので 口まわりは (w + d) × 2
function bentoCord(p) { return cord50((p.w + p.d) * 2 + 200); }

// ---------- ④ 信玄袋 ----------
// 丸い底 + 本体2枚(両わきに あき → ひもを左右から通せる)。裏布つき。底に厚紙の底板。
export const waShingen = {
  id: 'wa-shingen',
  name: '信玄袋',
  group: 'wa',
  level: 2,
  trend: false,
  desc: '丸い底の、和装にも合う手さげ袋。ひもで口をしぼります。',
  sizes: {
    S: { w: 190, h: 200, d: 120, bottomDia: 120, casing: 20, openStop: 50, handleLen: 250, cordW: 5 },
    M: { w: 240, h: 240, d: 150, bottomDia: 150, casing: 20, openStop: 60, handleLen: 300, cordW: 5 },
    L: { w: 280, h: 280, d: 180, bottomDia: 180, casing: 25, openStop: 70, handleLen: 350, cordW: 6 },
  },
  sizeNote: { S: 'お財布とハンカチ(着物のときに)', M: 'お茶会・お稽古の小物', L: 'ふだんの手さげに' },
  sizeText: (p) => `底の直径${cmText(p.bottomDia)}cm×高さ${cmText(p.h)}cm(平らに置くとよこ${cmText(p.w)}cm)`,

  shape(p) {
    const cord = shingenCord(p);
    return {
      family: 'cylinder', w: p.bottomDia, h: p.h, d: p.bottomDia, topW: r5(p.w * 0.4), corner: 0,
      flap: null, closure: 'drawstring', bottom: 'round',
      handles: [{ type: 'cord', len: cord, width: p.cordW }, { type: 'cord', len: cord, width: p.cordW }],
      pocket: null,
    };
  },

  pieces(p) {
    const D = p.bottomDia, r = D / 2;
    const cw = (Math.PI * D) / 2;            // 本体1枚の幅 = 底の円の半周
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        outline: rect(cw, p.h), seam: [p.casing + 10, 10, 10, 10], fold: null,
        grain: [[cw * 0.12, p.h * 0.3], [cw * 0.12, p.h * 0.8]],
        labelAt: [cw / 2, p.h * 0.58],
        marks: [
          ...casingMarks(cw, p.casing, p.openStop),
          ...liningTopMarks(cw, p.casing),
          { type: 'notch', at: [cw / 2, p.h] },
          note([cw / 2, p.h - 8], '合い印を底の印に合わせる'),
        ],
      },
      {
        id: 'bottom', name: '底', cut: 1, fabric: 'accent', more: [{ fabric: 'lining', cut: 1 }],
        outline: circle(r, r, r, 96), seam: 10, fold: null,
        grain: [[r, r * 0.2], [r, r * 0.55]],
        labelAt: [r, r * 1.12],
        marks: [
          { type: 'notch', at: [2 * r, r] }, { type: 'notch', at: [r, 2 * r] },
          { type: 'notch', at: [0, r] }, { type: 'notch', at: [r, 0] },
          { type: 'line', closed: true, pts: circle(r, r, r - 2, 72) },
          note([r, r * 1.62], '点線 = 底板(厚紙)を切る線'),
        ],
      },
    ];
  },

  matches() {
    return [
      { label: '底の円のまわり と 本体2枚の下の辺', a: { piece: 'body', from: 2, to: 3, times: 2 }, b: { piece: 'bottom' }, tol: 2 },
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 3, to: 0 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('表布の本体を2枚、配色布の底を1枚'),
      '裏布も、本体2枚(口は型紙の点線の所で切る)と底1枚を切ります。',
      '厚紙を、底の型紙の点線で切ります(底板)。',
      markStep(['合い印(▲)', 'あき止まり(●)', '口の折り線']),
      '表布の本体2枚を表どうしを内側にして重ね、両わきを、あき止まりから下まで縫います。',
      'わきの縫い代を、アイロンで割ります。',
      'あき止まりより上の縫い代を、コの字に縫いとめます。',
      '本体の下の縫い代に、2cmおきに5mmの切りこみを入れます。',
      '底と本体を、4つの合い印(わきの縫い目も合い印です)を合わせて待ち針でとめ、ぐるりと縫います。',
      '裏布の本体と底も、同じように縫います(わきは、上から下まで縫ってよい)。',
      '表袋を表に返して、底に底板を入れます。',
      '裏袋を、裏が外のまま表袋の中に入れて、底を合わせます。',
      `口を1cm折り、さらに${cmText(p.casing)}cm折って裏布の口をはさみ、下のはしをぐるりと縫います(ひも通し)。`,
      `ひも(${cmText(shingenCord(p))}cm)を左右から1本ずつ通し、はしを結んで持ち手にしたら、できあがりです。`,
    ];
  },

  extras(p) {
    return [
      `丸ひも(太さ${p.cordW}mm) ${cmText(shingenCord(p))}cm×2本`,
      `厚紙(底板) 直径${cmText(p.bottomDia - 4)}cm 1枚(型紙の底の点線で切る)`,
      'ひも通し(安全ピンでもできます)',
    ];
  },
};
// ひも1本: 口まわり(π×直径) + 手さげぶん + 結ぶぶん 50mm
function shingenCord(p) { return cord50(Math.PI * p.bottomDia + p.handleLen + 50); }

// ---------- ⑤ 巾着トート ----------
// まちつきトートの口に、巾着(口布の輪)をはさんで縫う。持ち手2本・裏布つき。
export const waBucket = {
  id: 'wa-bucket',
  name: '巾着トート',
  group: 'wa',
  level: 2,
  trend: true,
  desc: '持ち手のあるトートの口に、巾着がついた袋。中身が見えず、こぼれません。',
  sizes: {
    S: { w: 240, h: 200, d: 100, kinH: 120, handleLen: 300, handleW: 25, casing: 20, cordW: 4 },
    M: { w: 300, h: 260, d: 120, kinH: 150, handleLen: 400, handleW: 25, casing: 20, cordW: 4 },
    L: { w: 360, h: 300, d: 150, kinH: 180, handleLen: 500, handleW: 30, casing: 25, cordW: 5 },
  },
  sizeNote: { S: 'お弁当・ペットボトル', M: 'お散歩・ちょっとそこまで', L: '旅行のサブバッグに' },

  shape(p) {
    const at = strapAt(p);
    return {
      family: 'boxed', w: p.w, h: p.h, d: p.d, corner: 0,
      flap: null, closure: 'drawstring', innerBagH: p.kinH, strapAt: at,
      handles: [
        { type: 'loop', len: p.handleLen, width: p.handleW },
        { type: 'loop', len: p.handleLen, width: p.handleW },
      ],
      pocket: null,
    };
  },

  pieces(p) {
    const W = p.w + p.d, c = p.d / 2, H = p.h + c, cx = W / 2;
    const at = strapAt(p), hw = p.handleW;
    const stop = p.casing + 30;              // 巾着の あき止まり(口から)
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }],
        outline: boxOutline(W, H, c), seam: 10, fold: 'bottom',
        grain: [[W * 0.1, H * 0.25], [W * 0.1, H * 0.7]],
        labelAt: [cx, H * 0.55],
        marks: [
          { type: 'notch', at: [cx - at - hw / 2, 0] }, { type: 'notch', at: [cx - at + hw / 2, 0] },
          { type: 'notch', at: [cx + at - hw / 2, 0] }, { type: 'notch', at: [cx + at + hw / 2, 0] },
          note([cx, 9], '▲持ち手を付ける位置'),
          { type: 'notch', at: [cx, 0] },
          note([W - c / 2, H - c / 2 + 1], 'マチ'),
          note([c / 2, H - c / 2 + 1], 'マチ'),
          note([W - 7, (H - c) * 0.5], '裏布はここに返し口12cm', true),
        ],
      },
      kinPiece(W, p.kinH, p.casing, stop),
      strapPiece({ finLen: p.handleLen, finW: hw, tuck: 20 }),
    ];
  },

  matches() {
    return [
      { label: '巾着2枚の下 と 本体の口(前と後ろ)', a: { piece: 'kin', from: 3, to: 4, times: 2 }, b: { piece: 'body', from: 0, to: 1, times: 2 } },
      { label: '本体の 左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
      { label: 'マチの角(よこ2つ と たて)', a: { piece: 'body', from: 2, to: 3, times: 2 }, b: { piece: 'body', from: 3, to: 4, times: 2 } },
      { label: '巾着の 左わき と 右わき', a: { piece: 'kin', from: 1, to: 2 }, b: { piece: 'kin', from: 5, to: 0 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('本体を表布と裏布で1枚ずつ', { fold: true }),
      lineCut('巾着の布2枚と持ち手2本'),
      markStep(['合い印(▲)']),
      strapSew(p.handleW),
      zigzag('巾着の布2枚の両わき'),
      '巾着の布2枚を表どうしを内側にして重ね、両わきを、あき止まりから下まで縫います。',
      'わきの縫い代を割り、あき止まりより上を、コの字に縫いとめます。',
      `巾着の口を1cm、さらに${cmText(p.casing)}cm折って縫います(ひも通し)。`,
      `本体の表布を表どうしを内側にして「わ」で折り、両わきを縫います。底の角を広げてまっすぐ縫い、マチ(${cmText(p.d)}cm)を作ります。`,
      '裏布も同じように縫います。わきに、返し口12cmを縫わずに残します。',
      `${OUT}${tackStep({ tuck: 20, note: false })}`,
      '巾着の輪を、裏が外のまま口を下に向けて、表袋にかぶせます(表どうしが合う)。口のはしをそろえて仮どめします。',
      MOUTH,
      TURN,
      `口のふちを縫いおさえます。巾着にひも(${cmText(bucketCord(p))}cm)を左右から1本ずつ通し、はしを結んだら、できあがりです。`,
    ];
  },

  extras(p) {
    return [
      `丸ひも(太さ${p.cordW}mm) ${cmText(bucketCord(p))}cm×2本`,
      'ひもどめ(コードストッパー) 1〜2個(あれば)',
      'ひも通し(安全ピンでもできます)',
    ];
  },
};
// 巾着の口布: 大きな長方形なので 布に直接線を引いて切る(縫い代こみ)。
// 点: 0 左上 → 1 右上 → 2 右下 → 3 下の縫い代のはし(右)→ 4 (左)→ 5 左下。3→4 が できあがりの幅
function kinPiece(W, kinH, casing, stop) {
  const CW = W + 20, CH = kinH + casing + 10 + 10;
  return {
    id: 'kin', name: '巾着(口布)', cut: 2, fabric: 'lining', unit: '枚',
    outline: [[0, 0], [CW, 0], [CW, CH], [W + 10, CH], [10, CH], [0, CH]], seam: 0, fold: null,
    grain: [[CW * 0.1, CH * 0.3], [CW * 0.1, CH * 0.7]], marks: [], measureOnly: true,
    note: `縫い代こみの大きさです。上のはしを1cm折り、さらに${cmText(casing)}cm折ってひも通しにします。わきは上のはしから${cmText(stop + casing + 10)}cm(あき止まり)まで縫いません。`,
  };
}

// 持ち手の中心の位置(口のまん中から)
function strapAt(p) { return r5(p.w * 0.22); }
// 巾着の口まわり = (w + d) × 2
function bucketCord(p) { return cord50((p.w + p.d) * 2 + 200); }

export const WA_BAGS = [waKinchaku, waAzuma, waBento, waShingen, waBucket];

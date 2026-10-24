// outing.js — おでかけ・エコバッグの仲間(型紙係C)
// 単位 mm。できあがり線で作る(縫い代は seam で足す)。y は下向き。
import { rect, cubic, quad, ellipse, join, perimeter } from '../geom.js';
import { strapPiece, foldPocket, placeBox, r5, cmText } from './parts.js';
import { boxOutline, stripOutline, fillet, idxOf, pathLen, gatherMarks } from './backpack.js';

// 口布(上が わ)。持ち手のはしを差しこむ位置の印つき
function bandPiece({ bandW, bandH, handleW, more, extraText }) {
  const cx = bandW / 2, g = r5(bandW * 0.34);
  const marks = [
    { type: 'notch', at: [cx, bandH] },
    { type: 'notch', at: [cx - g / 2, bandH] }, { type: 'notch', at: [cx - g / 2 - handleW, bandH] },
    { type: 'notch', at: [cx + g / 2, bandH] }, { type: 'notch', at: [cx + g / 2 + handleW, bandH] },
    { type: 'text', at: [cx, bandH - 6], text: '▼持ち手のはしを差しこむ位置', size: 2.8 },
  ];
  if (extraText) marks.push({ type: 'text', at: [cx, Math.min(bandH * 0.3, 12)], text: extraText, size: 2.6 });
  return {
    id: 'band', name: '口布', cut: 2, fabric: 'accent', more,
    outline: rect(bandW, bandH), seam: 10, fold: 'top',
    grain: [[bandW * 0.08, bandH * 0.2], [bandW * 0.08, bandH * 0.8]],
    labelAt: [cx, bandH * 0.5],
    marks,
  };
}

// ---------- ① たためるエコバッグ(レジ袋の形) ----------
// 型紙は半分(左が わ = まん中)。上のまん中を U 字に切りぬき、のこりが持ち手。
export const outEco = {
  id: 'out-eco',
  name: 'たためるエコバッグ',
  group: 'outing',
  level: 2,
  trend: true,
  desc: 'レジ袋と同じ形の、うすくて軽いエコバッグ。小さくたたんでバッグに入れておけます。',
  sizes: {
    S: { w: 280, h: 280, d: 100, handleH: 150, handleW: 50, sackW: 100, sackH: 120 },
    M: { w: 350, h: 350, d: 140, handleH: 180, handleW: 60, sackW: 120, sackH: 140 },
    L: { w: 420, h: 400, d: 160, handleH: 200, handleW: 70, sackW: 140, sackH: 160 },
  },
  sizeNote: { S: 'コンビニのお買いもの', M: 'スーパーで2〜3日分', L: 'まとめ買い・お米5kgも' },
  sizeText: (p) => `よこ${cmText(p.w)}cm × たて${cmText(p.h)}cm × マチ${cmText(p.d)}cm(持ち手${cmText(p.handleH)}cm)`,

  shape(p) {
    return {
      family: 'trapezoid', w: p.w, h: p.h, d: p.d, topW: p.w, corner: 0,
      flap: null, closure: null,
      handles: [{ type: 'loop', len: p.handleH * 2, width: p.handleW }],
      pocket: null, handleCut: true, handleMaterial: 'self',
    };
  },

  // 点 0〜24: U字(まん中の底 → 持ち手の内がわの先)、25 持ち手の先の外、26 あき止まり、27〜29 マチの角、30 底のまん中
  body(p) {
    const X = (p.w + p.d) / 2, c = p.d / 2, hH = p.handleH, H = hH + p.h + c, xi = X - p.handleW;
    return join(
      cubic([0, hH], [xi * 0.6, hH], [xi, hH * 0.55], [xi, 0], 24),
      [[X, 0], [X, hH], [X, H - c], [X - c, H - c], [X - c, H], [0, H]],
    );
  },

  pieces(p) {
    const X = (p.w + p.d) / 2, c = p.d / 2, hH = p.handleH, H = hH + p.h + c, xi = X - p.handleW;
    const o = this.body(p);
    const Lc = pathLen(o, 0, 24);
    const seam = [...new Array(24).fill(0), 10, 0, 10, 10, 10, 10, 10];
    return [
      {
        id: 'body', name: '本体(持ち手と続き)', cut: 2, fabric: 'outer',
        outline: o, seam, fold: 'left',
        grain: [[X * 0.55, hH + 30], [X * 0.55, hH + p.h * 0.7]],
        labelAt: [X * 0.45, hH + p.h * 0.5],
        marks: [
          { type: 'notch', at: [(xi + X) / 2, 0] },
          { type: 'text', at: [(xi + X) / 2, 10], text: '持ち手の先', size: 3 },
          { type: 'text', at: [(xi + X) / 2, 16], text: '前と後ろを縫う', size: 2.6 },
          { type: 'dot', at: [X, hH], label: '' },
          { type: 'text', at: [X - 4, hH + 6], text: 'あき止まり', size: 3, anchor: 'end' },
          { type: 'text', at: [X / 2, hH + 14], text: 'U字の口と持ち手の外がわは縫い代なし(バイアスでくるむ)', size: 3 },
          { type: 'notch', at: [X, hH + p.h / 2] },
          { type: 'text', at: [X - c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
        ],
      },
      {
        id: 'bias', name: '口のふちどり(バイアス)', cut: 2, fabric: 'accent', unit: '本',
        outline: stripOutline(Lc * 2, 20, 10), seam: 0, fold: null, measureOnly: true,
        note: '布を45°ななめに切る。市販のバイアステープでもよい',
      },
      {
        id: 'bias2', name: '持ち手の外がわのふちどり(バイアス)', cut: 2, fabric: 'accent', unit: '本',
        outline: stripOutline(hH * 2, 20, 10), seam: 0, fold: null, measureOnly: true,
        note: '布を45°ななめに切る。市販のバイアステープでもよい',
      },
      {
        id: 'sack', name: 'しまう袋', cut: 1, fabric: 'outer',
        outline: rect(p.sackW, p.sackH), seam: [20, 10, 10, 10], fold: 'bottom',
        grain: [[p.sackW * 0.15, p.sackH * 0.3], [p.sackW * 0.15, p.sackH * 0.8]],
        labelAt: [p.sackW / 2, p.sackH * 0.6],
        marks: [
          { type: 'line', pts: [[0, -10], [p.sackW, -10]], label: '①1cm折る' },
          { type: 'text', at: [p.sackW / 2, 6], text: '↑②もう1cm折って縫う', size: 2.8 },
          { type: 'dot', at: [p.sackW / 2, 14], label: 'スナップ' },
        ],
      },
    ];
  },

  matches(p) {
    return [
      { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: 27, to: 28 }, b: { piece: 'body', from: 28, to: 29 } },
      { label: '口のバイアス と U字の口', a: { piece: 'bias', from: 1, to: 2 }, b: { piece: 'body', from: 0, to: 24, times: 2 } },
      { label: '外がわのバイアス と 持ち手の外がわ(前と後ろ)', a: { piece: 'bias2', from: 1, to: 2 }, b: { piece: 'body', from: 25, to: 26, times: 2 } },
    ];
  },

  biasCm(p) {
    const Lc = pathLen(this.body(p), 0, 24);
    return Math.ceil((2 * (Lc * 2 + 20) + 2 * (p.handleH * 2 + 20)) / 100) * 10;
  },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '布を二つに折り、型紙の「わ」を折り山に合わせて、本体を2枚切ります(前と後ろ)。しまう袋も切ります。',
      '前と後ろを表どうしを内側に重ね、あき止まりから下の両わきと底を縫います。縫い代はジグザグ縫いでほつれどめします。',
      `底の角を広げて、まっすぐ縫ってマチを作ります(マチ${cmText(p.d)}cm)。`,
      '持ち手の先を、前と後ろで表どうしを内側にして縫い、輪にします。縫い代は開いて押さえ縫いします。',
      'U字の口を、バイアスでくるんで縫います。前と後ろ、両方です。',
      '持ち手の外がわも、あき止まりからあき止まりまで、バイアスでくるんで縫います。',
      'しまう袋は、口を三つ折りにして縫い、底で折って両わきを縫って表に返し、スナップをつけます。',
      'しまう袋を、本体の内がわのわきの縫い代に縫いとめます。',
      '持ち手の先のつなぎ目を、もう一度押さえ縫いして丈夫にすればできあがりです。',
    ];
  },

  extras(p) {
    return [`バイアステープ(両折り12.7mm)約${this.biasCm(p)}cm(布で作らないとき)`, 'スナップボタン1組(たたんでとめる)'];
  },
};

// ---------- ② ギャザーのマルシェバッグ ----------
export const outMarche = {
  id: 'out-marche',
  name: 'ギャザーのマルシェバッグ',
  group: 'outing',
  level: 2,
  trend: true,
  desc: '口にギャザーを寄せた、ふんわりした買いものバッグ。市場(マルシェ)へ行く気分で。',
  sizes: {
    S: { w: 300, h: 220, d: 120, bandW: 260, bandH: 50, handleLen: 300, handleW: 30 },
    M: { w: 380, h: 280, d: 150, bandW: 320, bandH: 60, handleLen: 350, handleW: 30 },
    L: { w: 440, h: 320, d: 180, bandW: 380, bandH: 70, handleLen: 450, handleW: 35 },
  },
  sizeNote: { S: 'パン・野菜を少し', M: 'お買いもの1回分', L: '肩にもかけられる・ピクニックに' },

  shape(p) {
    return {
      family: 'gathered', w: p.w, h: p.h, d: p.d, topW: p.bandW, corner: 0, band: p.bandH,
      flap: null, closure: null,
      handles: [{ type: 'loop', len: p.handleLen, width: p.handleW }],
      pocket: null,
    };
  },

  pieces(p) {
    const W = p.w + p.d, c = p.d / 2, H = p.h - p.bandH + c, cx = W / 2;
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }],
        outline: boxOutline(W, H, c), seam: 10, fold: 'bottom',
        grain: [[W * 0.1, H * 0.35], [W * 0.1, H * 0.75]],
        labelAt: [cx, H * 0.58],
        marks: [
          ...gatherMarks(0, W, 0, p.bandW, -1),
          { type: 'notch', at: [cx, 0] },
          { type: 'text', at: [W - c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'text', at: [c / 2, H - c / 2 + 1], text: 'マチ', size: 4 },
        ],
      },
      bandPiece({ bandW: p.bandW, bandH: p.bandH, handleW: p.handleW }),
      strapPiece({ finLen: p.handleLen, finW: p.handleW, tuck: 30, fabric: 'accent' }),
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 7, to: 0 } },
      { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 3, to: 4 } },
      { label: '口布の左わき と 右わき', a: { piece: 'band', from: 1, to: 2 }, b: { piece: 'band', from: 3, to: 0 } },
    ];
  },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '本体は布を二つに折って「わ」に合わせ、表布と裏布を1枚ずつ切ります。口布2枚を切り、持ち手は布に線を引いて2本切ります。',
      `持ち手を四つ折りにして、両はしを縫います(できあがり幅${cmText(p.handleW)}cm)。`,
      `本体を表どうしを内側にして底で折り、両わきを縫います。底の角を広げてまっすぐ縫い、マチを作ります(マチ${cmText(p.d)}cm)。`,
      '裏布も同じに縫います。',
      '表袋の中に、裏袋を外表で入れ、口を重ねて仮どめします。',
      `口の縫い代にあらい目のミシンを2本かけ、糸を引いてギャザーを寄せます。前と後ろ、それぞれ${cmText(p.bandW)}cmにします。`,
      '口布2枚の両わきを縫って輪にし、「わ」で半分に折ってアイロンをかけます。',
      '口布をひらき、片がわのはしを袋の口に表どうしで合わせて、ぐるりと縫います。',
      '口布を内がわへ折り返し、のこりのはしを1cm折りこんで、持ち手のはしを印の所に差しこみます。',
      '口布のまわりをぐるりと縫って、持ち手もいっしょに縫いとめればできあがりです。',
    ];
  },

  extras(p) {
    return p.key === 'L' ? ['マグネットボタン1組(つけるなら)'] : ['布と糸だけでできます'];
  },
};

// ---------- ③ ころんとバルーンバッグ ----------
// 本体2枚(わきがふくらむ形)。上は口布に、下はだ円の底に、ギャザーを寄せて付ける。
export const outBalloon = {
  id: 'out-balloon',
  name: 'ころんとバルーンバッグ',
  group: 'outing',
  level: 2,
  trend: true,
  desc: '上と下にギャザーを寄せた、風船のように丸い手さげ。かわいくて人気の形。',
  sizes: {
    S: { w: 260, h: 200, d: 100, bandW: 200, bandH: 40, bottomW: 180, handleLen: 250, handleW: 25 },
    M: { w: 320, h: 240, d: 120, bandW: 240, bandH: 50, bottomW: 220, handleLen: 300, handleW: 30 },
    L: { w: 380, h: 280, d: 140, bandW: 280, bandH: 50, bottomW: 260, handleLen: 350, handleW: 30 },
  },
  sizeNote: { S: 'お財布とハンカチ', M: 'ちょっとしたおでかけ', L: 'お弁当や上着も' },

  shape(p) {
    return {
      family: 'round', w: p.w, h: p.h, d: p.d, topW: p.bandW, corner: 0, band: p.bandH,
      bottom: 'oval', bottomW: p.bottomW,
      flap: null, closure: null,
      handles: [{ type: 'loop', len: p.handleLen, width: p.handleW }],
      pocket: null,
    };
  },

  dims(p) {
    const Wm = r5(p.w * 1.3), Wt = r5(p.w * 1.15), Wb = r5(p.w * 1.15), H = p.h - p.bandH;
    return { Wm, Wt, Wb, H };
  },
  oval(p) { return ellipse(p.bottomW / 2, p.d / 2, p.bottomW / 2, p.d / 2, 96); },

  // 点 0 左上、1 右上、1〜17 右わきのふくらみ、17 右下、18 左下、18〜0 左わき
  body(p) {
    const { Wm, Wt, Wb, H } = this.dims(p);
    const tl = [(Wm - Wt) / 2, 0], tr = [(Wm + Wt) / 2, 0], br = [(Wm + Wb) / 2, H], bl = [(Wm - Wb) / 2, H];
    const cR = [(4 * Wm - tr[0] - br[0]) / 2, H / 2], cL = [(0 - tl[0] - bl[0]) / 2, H / 2];
    return join([tl], quad(tr, cR, br, 16), quad(bl, cL, tl, 16));
  },

  pieces(p) {
    const { Wm, Wt, Wb, H } = this.dims(p);
    const half = perimeter(this.oval(p)) / 2;
    const a = p.bottomW / 2, b = p.d / 2;
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        outline: this.body(p), seam: 10, fold: null,
        grain: [[Wm * 0.5, H * 0.4], [Wm * 0.5, H * 0.62]],
        labelAt: [Wm / 2, H * 0.5],
        marks: [
          ...gatherMarks((Wm - Wt) / 2, (Wm + Wt) / 2, 0, p.bandW, -1),
          ...gatherMarks((Wm - Wb) / 2, (Wm + Wb) / 2, H, half, 1, '(底の半分)'),
          { type: 'notch', at: [Wm / 2, 0] }, { type: 'notch', at: [Wm / 2, H] },
        ],
      },
      {
        id: 'bottom', name: '底(だ円)', cut: 1, fabric: 'outer', more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: this.oval(p), seam: 10, fold: null,
        grain: [[a, b * 0.3], [a, b * 0.75]],
        labelAt: [a, b * 1.05],
        marks: [
          { type: 'notch', at: [2 * a, b] }, { type: 'notch', at: [0, b] },
          { type: 'notch', at: [a, 0] }, { type: 'notch', at: [a, 2 * b] },
          { type: 'text', at: [a * 0.42, b], text: 'わき', size: 3 }, { type: 'text', at: [a * 1.58, b], text: 'わき', size: 3 },
          { type: 'text', at: [a, 2 * b - 7], text: 'まん中', size: 2.8 },
        ],
      },
      bandPiece({ bandW: p.bandW, bandH: p.bandH, handleW: p.handleW, more: [{ fabric: 'interfacing', cut: 2 }], extraText: '接着芯は細い線で切る' }),
      strapPiece({ finLen: p.handleLen, finW: p.handleW, tuck: 30, fabric: 'accent' }),
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 17 }, b: { piece: 'body', from: 18, to: 0 } },
      { label: '口布の左わき と 右わき', a: { piece: 'band', from: 1, to: 2 }, b: { piece: 'band', from: 3, to: 0 } },
    ];
  },

  steps(p) {
    const half = perimeter(this.oval(p)) / 2;
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '表布と裏布で、本体2枚と底1枚を切ります。口布2枚も切り、底と口布に接着芯をはります。',
      `持ち手を四つ折りにして、両はしを縫います(できあがり幅${cmText(p.handleW)}cm)。`,
      '本体2枚を表どうしを内側に重ね、両わきを縫って筒にします。',
      `筒の下の縫い代にあらい目のミシンを2本かけ、糸を引いてギャザーを寄せます(前と後ろ、それぞれ${cmText(half)}cm)。`,
      '筒と底を、合い印(わきとまん中)をそろえて待ち針でとめ、ぐるりと縫います。',
      '裏布も同じに、筒と底を縫います。',
      `表袋の中に裏袋を外表で入れて口を重ね、口にもギャザーを寄せます(前と後ろ、それぞれ${cmText(p.bandW)}cm)。`,
      '口布2枚の両わきを縫って輪にし、片がわのはしを袋の口に表どうしで合わせて縫います。',
      '口布を内がわへ折り返し、のこりのはしを1cm折りこんで、持ち手のはしを印の所に差しこみます。',
      '口布のまわりをぐるりと縫って、持ち手もいっしょに縫いとめればできあがりです。',
    ];
  },

  extras(p) {
    return [...(p.key === 'L' ? ['マグネットボタン1組(つけるなら)'] : []), '接着芯(底と口布のぶん)', '底板(あれば・底と同じ形に切る)'];
  },
};

// ---------- ④ むすびバッグ ----------
// 本体の上に、左は長い持ち手、右は短い持ち手。布を2枚重ねて切ると、左右反対の2枚になる。
export const outKnot = {
  id: 'out-knot',
  name: 'むすびバッグ',
  group: 'outing',
  level: 2,
  trend: true,
  desc: '長い持ち手を短い持ち手に通して結ぶ、手首にかけるバッグ。ノットバッグともいいます。',
  sizes: {
    S: { w: 200, h: 200, d: 60, longH: 300, shortH: 120, handleW: 40 },
    M: { w: 260, h: 260, d: 80, longH: 380, shortH: 150, handleW: 45 },
    L: { w: 320, h: 300, d: 100, longH: 450, shortH: 180, handleW: 50 },
  },
  sizeNote: { S: 'スマホ・お財布(手首にかける)', M: 'ハンカチ・ポーチも入る', L: 'サブバッグ・お弁当' },
  sizeText: (p) => `よこ${cmText(p.w)}cm × たて${cmText(p.h)}cm × マチ${cmText(p.d)}cm(長い持ち手${cmText(p.longH)}cm)`,

  shape(p) {
    return {
      family: 'knot', w: p.w, h: p.h, d: p.d, corner: 0,
      flap: null, closure: 'tie',
      handles: [{ type: 'knot', len: p.longH * 2, width: p.handleW }],
      knotShort: { len: p.shortH * 2, width: p.handleW },
      pocket: null, handleMaterial: 'self',
    };
  },

  // 点: 0 長い持ち手の先(外) 1 先(内) 1〜21 U字の左 21 U字の底 21〜41 U字の右 41 短い持ち手の先(内)
  // 42 先(外) 43 右のあき止まり 44〜46 右の角 47〜49 左の角 50 左のあき止まり
  body(p) {
    const W = p.w + p.d, c = p.d / 2, hw = p.handleW, LH = p.longH, SH = p.shortH, Hb = LH + p.h + c, xm = W / 2;
    return join(
      [[0, 0]],
      cubic([hw, 0], [hw, LH * 0.75], [hw + (xm - hw) * 0.2, LH], [xm, LH], 20),
      cubic([xm, LH], [xm + (W - hw - xm) * 0.8, LH], [W - hw, LH - SH * 0.25], [W - hw, LH - SH], 20),
      [[W, LH - SH], [W, LH], [W, Hb - c], [W - c, Hb - c], [W - c, Hb], [c, Hb], [c, Hb - c], [0, Hb - c], [0, LH]],
    );
  },

  pieces(p) {
    const W = p.w + p.d, c = p.d / 2, hw = p.handleW, LH = p.longH, SH = p.shortH, Hb = LH + p.h + c;
    return [
      {
        id: 'body', name: '本体(持ち手と続き)', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: this.body(p), seam: 7, fold: null,
        grain: [[W * 0.5, LH + 30], [W * 0.5, LH + p.h * 0.45]],
        labelAt: [W / 2, LH + p.h * 0.62],
        marks: [
          { type: 'notch', at: [hw / 2, 0] }, { type: 'notch', at: [W - hw / 2, LH - SH] },
          { type: 'text', at: [hw / 2, 8], text: '↑先は縫わない', size: 2.6 },
          { type: 'text', at: [W - hw / 2, LH - SH + 8], text: '↑先は縫わない', size: 2.6 },
          { type: 'text', at: [hw / 2, LH * 0.45], text: '長い持ち手', size: 3 },
          { type: 'text', at: [W - hw / 2, LH - SH * 0.45], text: '短い持ち手', size: 3 },
          { type: 'dot', at: [0, LH], label: 'あき止まり' }, { type: 'dot', at: [W, LH] },
          { type: 'text', at: [W / 2, LH + 12], text: 'U字の口と持ち手の外がわは、表布と裏布を合わせて縫う', size: 3 },
          { type: 'text', at: [W - c / 2, Hb - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'text', at: [c / 2, Hb - c / 2 + 1], text: 'マチ', size: 4 },
          { type: 'notch', at: [W / 2, Hb] },
          { type: 'text', at: [W / 2, Hb - 14], text: '裏布は底に返し口10cm', size: 3 },
          { type: 'text', at: [W / 2, Hb - 8], text: '接着芯は細い線で切る', size: 2.8 },
        ],
      },
    ];
  },

  matches(p) {
    const o = this.body(p);
    const W = p.w + p.d, c = p.d / 2, LH = p.longH, Hb = LH + p.h + c;
    const i43 = idxOf(o, [W, LH]), i44 = idxOf(o, [W, Hb - c]), i45 = idxOf(o, [W - c, Hb - c]), i46 = idxOf(o, [W - c, Hb]);
    const i49 = idxOf(o, [0, Hb - c]), i50 = idxOf(o, [0, LH]);
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: i43, to: i44 }, b: { piece: 'body', from: i49, to: i50 } },
      { label: 'マチの角(よこ と たて)', a: { piece: 'body', from: i44, to: i45 }, b: { piece: 'body', from: i45, to: i46 } },
    ];
  },

  steps() {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '布を2枚重ねて、表布・裏布・接着芯を2枚ずつ切ります(左右反対の2枚になります)。',
      '表布に、うすい接着芯をはります。',
      '表布2枚を表どうしを内側に重ね、あき止まりから下の両わきと底を縫い、底の角をまっすぐ縫ってマチを作ります。',
      '裏布も同じに縫います。底に返し口10cmを残します。',
      '表袋を裏袋の中に入れ(表どうしが内側)、U字の口と、持ち手の外がわ(あき止まりから先まで)を縫います。持ち手の先は縫いません。',
      '曲がる所の縫い代に切りこみを入れ、返し口から表に返します。',
      '持ち手の先を、表布どうし(前と後ろ)で表を内側にして縫い合わせ、輪にします。裏布どうしも同じに縫います。',
      '縫い代を中に入れて、持ち手の先のあいている所をまつります。',
      '返し口をとじ、長い持ち手を短い持ち手に通して結べばできあがりです。',
    ];
  },

  extras() {
    return ['うすい接着芯(本体2枚ぶん)'];
  },
};

// ---------- ⑤ グラニーバッグ ----------
// 本体は台形で下の角が大きな丸。口にギャザーを寄せて、持ち手と続きの口布ではさむ。
export const outGranny = {
  id: 'out-granny',
  name: 'グラニーバッグ',
  group: 'outing',
  level: 2,
  trend: false,
  desc: 'おばあちゃんの手さげ、という名前の、ギャザーたっぷりの大きな袋。なつかしく、たくさん入ります。',
  sizes: {
    S: { w: 300, h: 260, d: 80, bandW: 180, bandH: 40, handleLen: 200, pw: 150, ph: 130 },
    M: { w: 380, h: 320, d: 100, bandW: 220, bandH: 45, handleLen: 250, pw: 180, ph: 150 },
    L: { w: 440, h: 360, d: 120, bandW: 260, bandH: 50, handleLen: 300, pw: 200, ph: 170 },
  },
  sizeNote: { S: 'お財布・ハンカチ・ポーチ', M: 'A4も入る・毎日の手さげ', L: '編みもの道具・旅行に' },
  sizeText: (p) => `いちばん広い所のよこ${cmText(p.w)}cm × たて${cmText(p.h)}cm`,

  shape(p) {
    return {
      family: 'gathered', w: p.w, h: p.h, d: p.d, topW: p.bandW, corner: p.d, band: p.bandH,
      flap: null, closure: null,
      handles: [{ type: 'loop', len: p.handleLen, width: p.bandH }],
      pocket: null, handleMaterial: 'self',
    };
  },

  dims(p) {
    const T = r5(p.w * 1.2), B = r5(p.w * 0.9), H = p.h - p.bandH, open = r5(H * 0.25);
    return { T, B, H, open };
  },

  // 点 0 左上、1 右上、そのあと 右下の丸 → 左下の丸
  body(p) {
    const { T, B, H } = this.dims(p);
    let o = [[0, 0], [T, 0], [(T + B) / 2, H], [(T - B) / 2, H]];
    o = fillet(o, 3, p.d);
    o = fillet(o, 2, p.d);
    return o;
  },

  pieces(p) {
    const { T, B, H, open } = this.dims(p);
    const sx = ((T - B) / 2) * (open / H);   // あき止まりの所の わきの x
    const pw = p.pw, ph = p.ph, py = Math.max(open + 30, 50);
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        outline: this.body(p), seam: 10, fold: null,
        grain: [[T * 0.2, H * 0.3], [T * 0.2, H * 0.7]],
        labelAt: [T / 2, py + ph + (H - py - ph) * 0.45],
        marks: [
          ...gatherMarks(0, T, 0, p.bandW, -1),
          { type: 'notch', at: [T / 2, 0] },
          { type: 'dot', at: [sx, open], label: 'あき止まり' }, { type: 'dot', at: [T - sx, open] },
          { type: 'text', at: [T / 2, Math.max(open - 4, 34)], text: 'あき止まりから上は、わきを縫わない', size: 3 },
          placeBox((T - pw) / 2, py, pw, ph, '(裏布1枚だけ)内ポケット付け位置'),
          { type: 'notch', at: [T / 2, H] },
        ],
      },
      {
        id: 'band', name: '口布(持ち手と続き)', cut: 2, fabric: 'accent', unit: '本',
        outline: rect(p.bandW + p.handleLen + 20, p.bandH * 2 + 20), seam: 0, fold: null, measureOnly: true,
        note: `縫い代1cmこみ。両はしを縫って輪にし、たて半分に折って使う。${cmText(p.bandW)}cmが袋の口、のこり${cmText(p.handleLen)}cmが持ち手`,
      },
      { ...foldPocket({ id: 'inpocket', name: '内ポケット', fabric: 'lining', pw, ph }) },
    ];
  },

  matches(p) {
    const o = this.body(p);
    const { T, B, H } = this.dims(p);
    // わきの まっすぐな所(丸のはじまりまで)
    const rs = 2;                                 // 右下の丸のはじまり(fillet で 点2 から丸になる)
    const ls = idxOf(o, flipX(o[rs], T));
    return [
      { label: '左わき と 右わき(まっすぐな所)', a: { piece: 'body', from: 1, to: rs }, b: { piece: 'body', from: ls, to: 0 } },
      { label: '右の丸 と 左の丸', a: { piece: 'body', from: rs, to: idxOf(o, [(T + B) / 2 - p.d, H]) }, b: { piece: 'body', from: idxOf(o, [(T - B) / 2 + p.d, H]), to: ls }, tol: 3 },
    ];
  },

  steps(p) {
    return [
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。口布は布に線を引いて2本切ります。',
      '表布と裏布で、本体を2枚ずつ切ります。内ポケットも切ります。',
      '内ポケットを「わ」で半分に折って縫い、表に返して、裏布1枚の印の所に縫いつけます。',
      '表布2枚を表どうしを内側に重ね、あき止まりから下のわきと底をぐるりと縫います。裏布も同じに縫います。',
      '丸い所の縫い代に、縫い目を切らないように切りこみを入れます。',
      '表袋を表に返して裏袋の中に入れ(表どうしが内側)、あき止まりから上のわきを、表布と裏布を合わせて縫います。',
      '口から表に返し、口の縫い代(表布と裏布をいっしょに)に、あらい目のミシンを2本かけます。',
      `糸を引いてギャザーを寄せ、前と後ろ、それぞれ${cmText(p.bandW)}cmにします。`,
      '口布の両はしを表どうしで縫って輪にし、長い2辺を1cmずつ折ってから、たて半分に折ります(アイロン)。',
      `口布の${cmText(p.bandW)}cmの所で前の口をはさんで縫い、のこりの持ち手の所は、ふちを縫い合わせます。`,
      'もう1本の口布も、後ろの口に同じにつければできあがりです。',
    ];
  },

  extras() {
    return ['布と糸だけでできます'];
  },
};

function flipX(pt, T) { return [T - pt[0], pt[1]]; }

export const OUTING_BAGS = [outEco, outMarche, outBalloon, outKnot, outGranny];

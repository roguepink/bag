// tote.js — トートバッグの仲間(型紙係)
import { strapPiece, foldPocket, placeBox, r5, cmText } from './parts.js';

// ① まちつきトート(底の角を四角く切りとってマチを作る・持ち手2本・内ポケット・裏布つき)
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

export const TOTE_BAGS = [toteBasic];

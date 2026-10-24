// wa.js — 和の袋の仲間(型紙係)
import { rect, circle } from '../geom.js';
import { cmText } from './parts.js';

// ③ まる底きんちゃく(丸い底・両わきから ひもを引く 両しぼり)
// 本体2枚は横に並べると一周。底の円のまわり = 本体2枚の下の辺。
export const kinchakuRound = {
  id: 'wa-kinchaku',
  name: 'まる底きんちゃく',
  group: 'wa',
  level: 2,
  trend: false,
  desc: '底がまるい きんちゃく袋。ひもを引くと口がしまります。',
  sizes: {
    S: { d: 100, h: 160 },
    M: { d: 150, h: 220 },
    L: { d: 200, h: 300 },
  },
  sizeNote: { S: 'コップや小物に', M: 'お弁当箱が入る', L: '着がえやタオルに' },
  sizeText: (p) => `底の直径 ${cmText(p.d)}cm × 高さ ${cmText(p.h)}cm`,

  shape(p) {
    const cord = cordLen(p);
    return {
      family: 'cylinder', w: p.d, h: p.h, d: p.d, corner: 0,
      flap: null, closure: 'drawstring',
      handles: [{ type: 'cord', len: cord, width: 4 }, { type: 'cord', len: cord, width: 4 }],
      pocket: null,
    };
  },

  pieces(p) {
    const cw = (Math.PI * p.d) / 2;   // 本体1枚の幅 = 底の円の半周
    const r = p.d / 2;
    const top = 35;                    // 口の縫い代(1cm 折って、2.5cm のひも通し)
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer',
        outline: rect(cw, p.h), seam: [top, 10, 10, 10], fold: null,
        grain: [[cw * 0.15, p.h * 0.3], [cw * 0.15, p.h * 0.8]],
        labelAt: [cw / 2, p.h * 0.6],
        marks: [
          { type: 'line', pts: [[0, -25], [cw, -25]], label: '① ここで 1cm 折る' },
          { type: 'text', at: [cw / 2, 6], text: '↑ ② ここで 2.5cm 折る(口)', size: 3 },
          { type: 'dot', at: [0, 30], label: 'あき止まり' },
          { type: 'dot', at: [cw, 30] },
          { type: 'text', at: [cw / 2, 18], text: 'わきは 口から あき止まりまで 縫わない', size: 3 },
          { type: 'notch', at: [cw / 2, p.h] },
          { type: 'text', at: [cw / 2, p.h - 8], text: '合い印を 底の印に合わせる', size: 3 },
        ],
      },
      {
        id: 'bottom', name: '底', cut: 1, fabric: 'outer',
        outline: circle(r, r, r, 96), seam: 10, fold: null,
        grain: [[r, r * 0.25], [r, r * 0.6]],
        labelAt: [r, r * 1.15],
        marks: [
          { type: 'notch', at: [2 * r, r] }, { type: 'notch', at: [r, 2 * r] },
          { type: 'notch', at: [0, r] }, { type: 'notch', at: [r, 0] },
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
      '型紙を印刷して貼り合わせ、いちばん外の線で切ります。',
      '本体を2枚、底を1枚 切ります。',
      '布のはしを ぐるりとジグザグ縫いして、ほつれないようにします。',
      '本体2枚を 表どうしを内側に重ね、両わきを「あき止まり」から下まで縫います。',
      'わきの縫い代を左右に開き、あきのまわりを コの字に縫いとめます。',
      '本体の下の縫い代に、2cm おきに 5mm の切りこみを入れます。',
      '底と本体を 合い印で合わせて待ち針でとめ、ぐるりと縫います。',
      '口を 1cm 折り、さらに 2.5cm 折って、下のはしを縫います(ひも通し)。',
      '表に返します。',
      `ひも(${cmText(cordLen(p))}cm)を 左右から1本ずつ通して、はしを結んで できあがりです。`,
    ];
  },

  extras(p) {
    return [`丸ひも(太さ 3〜4mm) ${cmText(cordLen(p))}cm × 2本`, 'ひも通し(安全ピンでも できます)'];
  },
};

// ひも1本の長さ: 口のまわり + 結ぶぶん
function cordLen(p) { return Math.round((Math.PI * p.d + 300) / 50) * 50; }

export const WA_BAGS = [kinchakuRound];

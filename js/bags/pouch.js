// pouch.js — ポーチ・小物の仲間(型紙係)
import { roundRect } from '../geom.js';
import { zipperCm, cmText } from './parts.js';

// ② ファスナーぺたんこポーチ(マチなし・底の角が丸い・裏布つき)
export const pouchZip = {
  id: 'pouch-zip',
  name: 'ファスナーぺたんこポーチ',
  group: 'pouch',
  level: 2,
  trend: false,
  desc: 'うすくて軽い、ファスナーのポーチ。カードや化粧品、通帳入れに。',
  sizes: {
    S: { w: 160, h: 110, r: 15 },
    M: { w: 200, h: 140, r: 20 },
    L: { w: 250, h: 180, r: 25 },
  },
  sizeNote: { S: 'カードやお薬に', M: '通帳や化粧品に', L: 'A5の手帳が入る' },

  shape(p) {
    return {
      family: 'flat', w: p.w, h: p.h, d: 12, corner: p.r,
      flap: null, closure: 'zip', handles: [], pocket: null,
    };
  },

  pieces(p) {
    const o = roundRect(p.w, p.h, [0, 0, p.r, p.r]);
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer', more: [{ fabric: 'lining', cut: 2 }],
        outline: o, seam: 10, fold: null,
        grain: [[p.w * 0.12, p.h * 0.25], [p.w * 0.12, p.h * 0.75]],
        labelAt: [p.w / 2, p.h * 0.58],
        marks: [
          { type: 'text', at: [p.w / 2, 9], text: '↑ ファスナーを付ける辺(口)', size: 3 },
          { type: 'notch', at: [p.w / 2, 0] },
          { type: 'notch', at: [p.w / 2, p.h] },
          { type: 'text', at: [p.w / 2, p.h - 8], text: '裏布は 底に 返し口 8cm', size: 3 },
        ],
      },
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: -1, to: 0 }, tol: 0.5 },
    ];
  },

  steps(p) {
    return [
      '型紙を印刷して、いちばん外の線で切ります。',
      '表布を2枚、裏布を2枚 切ります。',
      `ファスナー(${zipperCm(p.w)}cm)と 表布1枚の口を、表どうしを合わせて重ねます。`,
      'その上に 裏布1枚を重ね(表布と表どうし)、3枚いっしょに口を縫います。',
      '表に返して、口の近くを縫いおさえます(ステッチ)。',
      'もう片方も、同じように縫います。',
      'ファスナーを 半分ほど開けておきます(あとで表に返すため。大事です)。',
      '表布どうし・裏布どうしを 表を内側に重ね、まわりを縫います。裏布の底に 返し口 8cm を残します。',
      '丸い角の縫い代に、縫い目を切らないように 切りこみを入れます。',
      '返し口から表に返して、返し口を縫いとじます。裏布を中に入れて、できあがりです。',
    ];
  },

  extras(p) {
    return [`ファスナー ${zipperCm(p.w)}cm 1本(口の幅 ${cmText(p.w)}cm に合うもの)`];
  },
};

export const POUCH_BAGS = [pouchZip];

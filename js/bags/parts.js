// parts.js — いろいろな袋で使い回すパーツ(型紙係)
// 単位 mm。できあがり線で作る(縫い代は seam で足す)。
import { rect } from '../geom.js';

export const r5 = (v) => Math.round(v / 5) * 5;          // 5mm 単位に
export const cmText = (mm) => String(Math.round(mm) / 10);

// 市販のファスナーの長さ(cm)から、口の幅に合うものを選ぶ
const ZIP_CM = [10, 12, 14, 15, 16, 18, 20, 22, 25, 30, 35, 40, 45, 50, 60];
export function zipperCm(openingMm) {
  const need = openingMm / 10;
  return ZIP_CM.find((z) => z >= need) ?? Math.ceil(need / 5) * 5;
}

// 持ち手・ひも(四つ折り)。布に直接線を引いて切る。
// finLen: できあがりの長さ、finW: できあがりの幅、tuck: 片側の差しこみ(本体に縫いこむ長さ)
export function strapPiece({ id = 'handle', name = '持ち手', cut = 2, fabric = 'outer', finLen, finW, tuck = 20, fold = 4 }) {
  const L = finLen + tuck * 2, W = finW * fold;
  const marks = [];
  for (let k = 1; k < fold; k++) marks.push({ type: 'line', pts: [[0, (W * k) / fold], [L, (W * k) / fold]], label: '折り線' });
  return {
    id, name, cut, fabric, unit: '本',
    outline: rect(L, W), seam: 0, fold: null,
    grain: [[L * 0.2, W / 2], [L * 0.8, W / 2]],
    marks, measureOnly: true,
    note: `${fold === 4 ? '四つ折り' : '三つ折り'}にして、はしを縫う。できあがり幅${cmText(finW)}cm`,
  };
}

// わ で折る ポケット(上が わ)。できあがり pw × ph
export function foldPocket({ id = 'pocket', name = '内ポケット', cut = 1, fabric = 'lining', pw, ph, seam = 10 }) {
  return {
    id, name, cut, fabric,
    outline: rect(pw, ph), seam, fold: 'top',
    grain: [[pw * 0.15, ph * 0.25], [pw * 0.15, ph * 0.8]],
    marks: [{ type: 'text', at: [pw / 2, ph - 12], text: `返し口${cmText(Math.min(80, pw * 0.4))}cmを残して縫う` }],
  };
}

// ポケット付け位置の四角(本体の上に描く印)
export function placeBox(x, y, w, h, label) {
  return { type: 'line', closed: true, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], label };
}

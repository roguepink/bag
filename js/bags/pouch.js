// pouch.js — ポーチ・小物の仲間(型紙係)
// 計画 data/bags-plan.json の pouch 5種類。単位 mm、できあがり線で作る(縫い代は seam で足す)。
// sizes の w・h・d は「できあがり」の寸法(マチつきは 前の面の幅)。
import { rect, arc, join, cubic, sub, length as lineLen } from '../geom.js';
import { cmText, r5 } from './parts.js';
import { PRINT, cutStep, markStep, TURN } from './steps-common.js';

// ---------- この仲間で使う道具 ----------

// 説明の文字。線の印(長さほぼ 0)のラベルとして書くと、型紙が 90°回されて並んでも 文字が いっしょに回る。
function note(at, text, vertical = false) {
  return { type: 'line', pts: [at, vertical ? [at[0], at[1] + 0.01] : [at[0] + 0.01, at[1]]], label: text };
}

// 底の角を四角く切りとった形(つまみマチ)。W 型紙の幅、H 型紙の高さ、c 切りとる四角
// 点の番号: 0 左上 → 1 右上 → 2 右わきの下 → 3 角 → 4 底の右 → 5 底の左 → 6 角 → 7 左わきの下
function boxOutline(W, H, c) {
  return [[0, 0], [W, 0], [W, H - c], [W - c, H - c], [W - c, H], [c, H], [c, H - c], [0, H - c]];
}

// 形の点の中で、pt にいちばん近い点の番号
function nearIdx(outline, pt) {
  let best = 0, bd = Infinity;
  outline.forEach((q, i) => { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < bd) { bd = d; best = i; } });
  return best;
}

// 小さな つまみ(ファスナーのはし)。4cm × 6cm を 四つ折り → 半分に折る
function tabPiece(cut) {
  return {
    id: 'tab', name: 'つまみ', cut, fabric: 'accent', unit: '枚',
    outline: rect(60, 40), seam: 0, fold: null,
    grain: [[10, 20], [50, 20]], marks: [], measureOnly: true,
    note: 'よこ6cm×たて4cmに切り、たてを四つ折りにして縫い(幅1cm)、半分に折ります。なくてもよい。',
  };
}

const zipText = (mm) => `${cmText(mm)}cm`;

// ---------- ① ぺたんこファスナーポーチ ----------
export const poFlat = {
  id: 'po-flat',
  name: 'ぺたんこファスナーポーチ',
  group: 'pouch',
  level: 1,
  trend: false,
  desc: 'マチのない、うすいポーチ。ファスナーつけのはじめの練習にちょうどよい形。',
  sizes: {
    S: { w: 150, h: 100, d: 0, zip: 150 },
    M: { w: 200, h: 130, d: 0, zip: 200 },
    L: { w: 240, h: 160, d: 0, zip: 250 },
  },
  sizeNote: { S: 'おくすり・ばんそうこう', M: '化粧品・通帳', L: '母子手帳・はがき・マスク' },

  shape(p) {
    return {
      family: 'flat', w: p.w, h: p.h, d: 0, corner: 0,
      flap: null, closure: 'zip', zip: 'top', handles: [], pocket: null,
    };
  },

  pieces(p) {
    const { w, h } = p;
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer',
        more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline: rect(w, h), seam: 10, fold: null,
        grain: [[w * 0.12, h * 0.28], [w * 0.12, h * 0.78]],
        labelAt: [w / 2, h * 0.55],
        marks: [
          note([w / 2, 8], '↑ 口(ファスナーを付ける辺)'),
          { type: 'notch', at: [w / 2, 0] },
          { type: 'notch', at: [w / 2, h] },
          note([w / 2, h - 7], '裏布は 底に 返し口 8cm を残す'),
        ],
      },
      tabPiece(1),
    ];
  },

  matches() {
    return [
      { label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 3, to: 0 } },
      { label: '前 と 後ろの底', a: { piece: 'body', from: 2, to: 3 }, b: { piece: 'body', from: 0, to: 1 } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('表布・裏布・接着芯を2枚ずつ', { more: 'つまみの布は、6cm×4cmに1枚切ります。' }),
      markStep(['合い印(▲)']),
      '表布の裏に、接着芯をアイロンではります。',
      'つまみの布を四つ折りにして縫い、半分に折ります(なくてもよい)。',
      `表布1枚の口にファスナー(${zipText(p.zip)})を表どうしを内側にして重ね、その上に裏布1枚を表を下にして重ねて、3枚いっしょに縫います。`,
      '表に返して、口のふちを縫いおさえます。反対がわも同じように、表布と裏布でファスナーをはさんで縫います。',
      'ファスナーを半分あけておきます(あとで表に返すため。大事です)。',
      '表布どうし・裏布どうしを、表どうしを内側にして重ねます。わきの口の近くに、つまみをはさみます。',
      'まわりをぐるりと縫います。ファスナーのはしも、わきの縫い代にはさんで縫います。裏布の底に、返し口8cmを残します。',
      'ファスナーのあまりを切り、角の縫い代をななめに切り落とします。',
      `${TURN}裏布を中に入れたら、できあがりです。`,
    ];
  },

  extras(p) {
    return [`ファスナー ${zipText(p.zip)} 1本`, '接着芯(うすいもの)'];
  },
};

// ---------- ② マチつきポーチ ----------
// 本体は 1枚の布を底で わ に折る。口の2辺に ファスナーを付けて輪にしてから、わきと マチを縫う。
export const poBox = {
  id: 'po-box',
  name: 'マチつきポーチ',
  group: 'pouch',
  level: 2,
  trend: false,
  desc: '底にマチがあり、立てて置ける小物入れ。化粧品やお薬に。',
  sizes: {
    S: { w: 120, h: 110, d: 60, zip: 180 },
    M: { w: 140, h: 130, d: 80, zip: 200 },
    L: { w: 160, h: 150, d: 100, zip: 250 },
  },
  sizeNote: { S: 'お薬・はんこ', M: '化粧品・ソーイング道具', L: '旅行の洗面用具' },

  shape(p) {
    return {
      family: 'boxed', w: p.w, h: p.h, d: p.d, corner: 8,
      flap: null, closure: 'zip', zip: 'top', handles: [], pocket: null,
    };
  },

  pieces(p) {
    const W = p.w + p.d, c = p.d / 2, H = p.h + c, cx = W / 2;
    return [
      {
        id: 'body', name: '本体', cut: 1, fabric: 'outer',
        more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: boxOutline(W, H, c), seam: 10, fold: 'bottom',
        grain: [[W * 0.12, H * 0.2], [W * 0.12, H * 0.62]],
        labelAt: [cx, H * 0.5],
        marks: [
          note([cx, 8], '↑ 口(ファスナーを付ける辺)'),
          { type: 'notch', at: [cx, 0] },
          note([W - c / 2, H - c / 2 + 1], 'マチ'),
          note([c / 2, H - c / 2 + 1], 'マチ'),
          note([W - 7, (H - c) * 0.5], '裏布は ここに 返し口 8cm', true),
        ],
      },
      tabPiece(2),
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
      cutStep('表布・裏布・接着芯を1枚ずつ', { fold: true }),
      markStep(['合い印(▲)']),
      '表布の裏に接着芯をはります。つまみの布は6cm×4cmに2枚切り、四つ折りにして縫って、半分に折ります。',
      `表布の口と裏布の口でファスナー(${zipText(p.zip)})をはさみ、3枚いっしょに縫います。表に返して、口のふちを縫いおさえます。`,
      'もう片方の口も、ファスナーの反対がわに同じように縫います。布が輪になります。',
      'ファスナーを半分あけておきます(あとで表に返すため。大事です)。',
      '表布どうし・裏布どうしを、表どうしを内側にして重ね、ファスナーのはしにつまみをはさみます。',
      '両わきを縫います。裏布のわきに、返し口8cmを残します。',
      `底の角の四角く切った所を広げ、わきの縫い目と底の折り山を合わせて、まっすぐ縫います(マチ${cmText(p.d)}cm)。表布も裏布も2か所ずつです。`,
      TURN,
      '裏布を中に入れ、角を指で押し出して形をととのえたら、できあがりです。',
    ];
  },

  extras(p) {
    return [`ファスナー ${zipText(p.zip)} 1本`, '接着芯(うすいもの)'];
  },
};

// ---------- ③ めがねケース ----------
// 前(口が上)と、後ろとふた(続き)。表布・裏布・キルト芯。まわりはバイアステープでくるむ。
function meganeBack(w, h, F, r) {
  const rt = Math.min(w / 2, F);
  return join(
    arc(rt, rt, rt, 180, 270),
    arc(w - rt, rt, rt, 270, 360),
    [[w, F]],
    arc(w - r, F + h - r, r, 0, 90),
    arc(r, F + h - r, r, 90, 180),
    [[0, F]],
  );
}
function meganeFront(w, h, r) {
  return join([[0, 0], [w, 0]], arc(w - r, h - r, r, 0, 90), arc(r, h - r, r, 90, 180));
}
const tapeLen = (p) => Math.ceil((2 * p.h + p.w + 80) / 50) * 50;

export const poMegane = {
  id: 'po-megane',
  name: 'めがねケース',
  group: 'pouch',
  level: 1,
  trend: false,
  desc: 'やわらかいキルトの、細長いめがね入れ。上の口はマグネットでとめます。',
  sizes: {
    S: { w: 80, h: 160, d: 0, flapH: 40, r: 15 },
    M: { w: 90, h: 180, d: 0, flapH: 40, r: 15 },
    L: { w: 110, h: 190, d: 0, flapH: 45, r: 15 },
  },
  sizeNote: { S: '細い老眼鏡', M: 'ふつうのめがね', L: '大きいめがね・サングラス' },

  shape(p) {
    return {
      family: 'flat', w: p.w, h: p.h, d: 0, corner: p.r,
      flap: { h: p.flapH, shape: 'round' }, closure: 'snap', handles: [], pocket: null,
    };
  },

  pieces(p) {
    const { w, h, flapH: F, r } = p;
    const t = F * 0.45; // マグネットの位置(ふたの先から)
    const back = meganeBack(w, h, F, r);
    return [
      {
        id: 'front', name: '前', cut: 1, fabric: 'outer',
        more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: meganeFront(w, h, r), seam: 10, fold: null,
        grain: [[w * 0.15, h * 0.2], [w * 0.15, h * 0.42]],
        labelAt: [w / 2, h * 0.55],
        marks: [
          note([w / 2, 6], '↑ 口'),
          { type: 'notch', at: [w / 2, h] },
          { type: 'dot', at: [w / 2, F - t] },
          note([w / 2, F - t + 6], 'マグネット凹(表布)'),
          note([w / 2, h - 14], 'キルト芯は 細い線で切る'),
        ],
      },
      {
        id: 'back', name: '後ろとふた(続き)', cut: 1, fabric: 'outer',
        more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
        outline: back, seam: 10, fold: null,
        grain: [[w * 0.15, F + h * 0.12], [w * 0.15, F + h * 0.38]],
        labelAt: [w / 2, F + h * 0.55],
        marks: [
          { type: 'line', pts: [[0, F], [w, F]], label: 'ふたの折り線' },
          { type: 'notch', at: [0, F] }, { type: 'notch', at: [w, F] },
          { type: 'notch', at: [w / 2, F + h] },
          { type: 'dot', at: [w / 2, t] },
          note([w / 2, t + 6], 'マグネット凸(裏布)'),
          note([w / 2, F + 8], '↑ ここから上が ふた'),
        ],
      },
    ];
  },

  matches(p) {
    const back = meganeBack(p.w, p.h, p.flapH, p.r);
    const iR = nearIdx(back, [p.w, p.flapH]), iL = nearIdx(back, [0, p.flapH]);
    return [
      { label: '前の横と底 と 後ろの横と底(バイアステープでくるむ所)', a: { piece: 'front', from: 1, to: 0 }, b: { piece: 'back', from: iR, to: iL } },
    ];
  },

  steps(p) {
    return [
      PRINT,
      cutStep('「前」と「後ろとふた(続き)」を、表布と裏布で1枚ずつ'),
      'キルト芯は、型紙の細い線(できあがり線)で切り、表布の裏にアイロンではります。',
      markStep(['合い印(▲)', 'ふたの折り線', 'マグネットの付け位置(●)']),
      'マグネットの凸をふたの裏布に、凹を前の表布に、印の所に付けます。',
      '前の表布と裏布を表どうしを内側にして重ね、口(上の辺)を縫います。表に返して、口のふちを縫いおさえます。',
      '「後ろとふた」の表布と裏布を表どうしを内側にして重ね、ふたの折り線から上(ふたのまわり)を縫います。',
      '折り線の両はしの縫い代に、縫い目のきわまで切りこみを入れます。ふたの丸い所にも切りこみを入れて、表に返します。',
      '「後ろとふた」の裏布の上に前を重ね(裏どうしを内側にして・外表)、横と底をぐるりと縫います。',
      `縫い代を5mmに切りそろえ、バイアステープ(約${cmText(tapeLen(p))}cm)でくるんで縫います。`,
      'ふたを折り線で折り、マグネットをとめたら、できあがりです。',
    ];
  },

  extras(p) {
    return [
      'マグネットボタン(うすいもの) 1組',
      '接着キルト芯(めがねを守る、厚みのある芯)',
      `バイアステープ 幅12.7mm × ${cmText(tapeLen(p))}cm`,
    ];
  },
};

// ---------- ④ がま口ポーチ ----------
// 口は 角型の口金の形。口金はメーカーで形がちがうので、手持ちの口金に合わせて口の線をなおす。
// 点の番号: 0 = 左のあき止まり。口 → 右のあき止まり → 右のふくらみ → 底のまん中 → 左。
function gamaOutline(p) {
  const { w, h } = p;
  const cx = w / 2, a = p.frameW / 2, fh = p.frameH;
  const rr = Math.min(a * 0.5, fh * 0.55);          // 口金の角の丸み
  const yW = fh + (h - fh) * 0.3;                    // いちばん広い高さ
  const R = [cx + a, fh];
  const s1 = cubic(R, [cx + a + (w / 2 - a) * 0.55, fh], [w, fh + (yW - fh) * 0.3], [w, yW], 14);
  const s2 = cubic([w, yW], [w, yW + (h - yW) * 0.62], [cx + (w / 2) * 0.62, h], [cx, h], 24);
  const M = (pts) => pts.map(([x, y]) => [w - x, y]).reverse();
  const outline = join(
    [[cx - a, fh]],
    arc(cx - a + rr, rr, rr, 180, 270),
    arc(cx + a - rr, rr, rr, 270, 360),
    [R], s1, s2, M(s2), M(s1),
  );
  return { outline, cx, a, fh, s2 };
}

// 曲線の上で、点 k から 長さ dist だけ進んだ(マイナスはもどる)点
function walk(pts, k, dist) {
  let i = k, left = Math.abs(dist);
  const step = dist >= 0 ? 1 : -1;
  while (true) {
    const j = i + step;
    if (j < 0 || j >= pts.length) return pts[i];
    const L = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
    if (left <= L) { const t = left / L; return [pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t]; }
    left -= L; i = j;
  }
}

// 底の角の ダーツ(三角につまんで縫う)。右と左に1つずつ
function gamaDarts(p, s2) {
  const k = Math.round(s2.length * 0.45);
  const E = s2[k];
  const A = walk(s2, k, -p.d / 4), B = walk(s2, k, p.d / 4);
  const tx = B[0] - A[0], ty = B[1] - A[1], L = Math.hypot(tx, ty) || 1;
  const nx = -ty / L, ny = tx / L;                  // 内向き(時計まわりの右手側)
  const len = p.d * 0.6;
  const apex = [E[0] + nx * len, E[1] + ny * len];
  const right = [A, apex, B];
  const left = right.map(([x, y]) => [p.w - x, y]);
  return [right, left];
}
const paperCord = (mouth) => Math.ceil((mouth * 2) / 50) * 5; // cm(2本ぶん)

export const poGama = {
  id: 'po-gama',
  name: 'がま口ポーチ',
  group: 'pouch',
  level: 3,
  trend: true,
  desc: 'パチンととじる金具の口。なつかしくて、いま また人気です。',
  sizes: {
    S: { w: 150, h: 120, d: 40, frameW: 120, frameH: 55 },
    M: { w: 190, h: 150, d: 50, frameW: 150, frameH: 65 },
    L: { w: 230, h: 180, d: 60, frameW: 180, frameH: 75 },
  },
  sizeNote: { S: '小銭・お薬(口金 12cm)', M: '化粧品・めがね(口金 15cm)', L: '化粧品・通帳(口金 18cm)' },

  shape(p) {
    return {
      family: 'round', w: p.w, h: p.h, d: p.d, topW: p.frameW, corner: 0,
      flap: null, closure: 'frame', handles: [], pocket: null,
    };
  },

  pieces(p) {
    const { outline, cx, a, fh, s2 } = gamaOutline(p);
    const [dR, dL] = gamaDarts(p, s2);
    const fs = Math.min(3.2, (2 * a) / 17);
    return [
      {
        id: 'body', name: '本体', cut: 2, fabric: 'outer',
        more: [{ fabric: 'lining', cut: 2 }, { fabric: 'interfacing', cut: 2 }],
        outline, seam: 7, fold: null,
        grain: [[cx - a * 0.8, fh * 0.25], [cx - a * 0.8, fh * 0.9]],
        labelAt: [cx, fh + (p.h - fh) * 0.5],
        marks: [
          note([cx, fh * 0.3], 'お手持ちの口金に重ねて、'),
          note([cx, fh * 0.3 + fs * 1.4], '口の線をなおしてください'),
          { type: 'notch', at: [cx, 0] },
          { type: 'notch', at: [cx, p.h] },
          { type: 'dot', at: [cx - a, fh] }, note([cx - a + 11, fh + 6], 'あき止まり'),
          { type: 'dot', at: [cx + a, fh] },
          { type: 'notch', at: [cx - a, fh] }, { type: 'notch', at: [cx + a, fh] },
          note([cx, fh * 0.3 + fs * 2.9], '(口金のちょうつがいの所 = あき止まり)'),
          { type: 'line', pts: dR, label: '' }, { type: 'line', pts: dL, label: '' },
          { type: 'notch', at: dR[0] }, { type: 'notch', at: dR[2] },
          { type: 'notch', at: dL[0] }, { type: 'notch', at: dL[2] },
          note([dL[1][0] + 2, dL[1][1] - 4], 'ダーツ'),
          note([cx, p.h - 8], '裏布は 底に 返し口 6cm'),
        ],
      },
    ];
  },

  matches(p) {
    const { outline, cx, a, fh } = gamaOutline(p);
    const iR = nearIdx(outline, [cx + a, fh]), iB = nearIdx(outline, [cx, p.h]);
    return [
      { label: 'あき止まりから底まで(右 と 左)', a: { piece: 'body', from: iR, to: iB }, b: { piece: 'body', from: iB, to: 0 }, tol: 0.5 },
    ];
  },

  steps(p) {
    const mouth = mouthLen(p);
    return [
      `はじめに口金を用意します(幅${cmText(p.frameW)}cm)。型紙を印刷し、口の線を口金に重ねてみます。形がちがうときは、口金のふちにそって線をなおします。`,
      '型紙を、いちばん外の線(切る線)で切ります。',
      cutStep('表布と裏布を2枚ずつ'),
      '接着芯は、型紙の細い線(できあがり線)で2枚切り、表布の裏にアイロンではります。縫い代に芯があると、口金に入りにくくなります。',
      markStep(['合い印(▲)', 'あき止まり(●)', 'ダーツの線']),
      '底の左右のダーツを、合い印を合わせて三角につまんで縫います。裏布も同じです。',
      '表布2枚を表どうしを内側にして重ね、あき止まりからあき止まりまで、底をぐるりと縫います。裏布も同じに縫い、底に返し口6cmを残します。',
      '表袋を表に返して裏袋の中に入れ(表どうしが内側)、口をあき止まりからあき止まりまで縫います(2か所)。',
      `あき止まりの縫い代に、縫い目のきわまで切りこみを入れます。${TURN}`,
      'うすい布のときだけ、口のまわりを縫いおさえます(厚い布は、縫うと口金に入らなくなります)。',
      `口金のみぞに手芸用ボンドを入れ、中心とあき止まりを合わせて、袋の口を目打ちで差しこみます。紙ひも(1本約${Math.round(mouth / 10)}cm)も押しこみます。`,
      'ボンドがかわいたら、口金の両はしに当て布をして、ペンチでかるくしめます。手の力が弱い方は、縫いつけ式の口金が楽です。',
    ];
  },

  extras(p) {
    return [
      `口金(角型・差しこみ式)幅${cmText(p.frameW)}cm 1個(幅は、外がわのはしからはしまで。くし型でも、口の線をなおせば使えます)`,
      `紙ひも 約${paperCord(mouthLen(p))}cm(口金の みぞ 2本ぶん)`,
      '手芸用ボンド・目打ち・ペンチ・当て布',
      '接着芯(うすいもの)',
      '手の力が弱い方は「縫いつけ式」の口金もおすすめです',
    ];
  },
};
function mouthLen(p) {
  const { outline, cx, a, fh } = gamaOutline(p);
  return lineLen(sub(outline, 0, nearIdx(outline, [cx + a, fh])));
}

// ---------- ⑤ 通帳・お薬手帳ケース ----------
// 1枚の長い布(下から 前 → 後ろ → ふた)。表布と裏布を縫って返し、前を折り上げて 両わきを縫う。
export const poCard = {
  id: 'po-card',
  name: '通帳・お薬手帳ケース',
  group: 'pouch',
  level: 1,
  trend: false,
  desc: 'ふたつきの平らな入れもの。通帳・お薬手帳・診察券をまとめておけます。',
  sizes: {
    S: { w: 110, h: 75, d: 0, flapH: 35 },
    M: { w: 130, h: 175, d: 0, flapH: 75 },
    L: { w: 170, h: 230, d: 0, flapH: 100 },
  },
  sizeNote: { S: '診察券・カード', M: '通帳・お薬手帳', L: 'A5 の手帳・母子手帳' },

  shape(p) {
    return {
      family: 'envelope', w: p.w, h: p.h, d: 0, corner: 0,
      flap: { h: p.flapH, shape: 'square' }, closure: 'snap', handles: [], pocket: null,
    };
  },

  pieces(p) {
    const { w, h, flapH: F } = p;
    const L = 2 * h + F;
    const hasPocket = p.key !== 'S';
    const ph = r5(h * 0.5);
    const t = F * 0.35;                        // スナップの位置(ふたの先から)
    const snap = p.key === 'S' ? 'スナップ' : 'マグネット';
    const body = {
      id: 'body', name: '本体(ふた・後ろ・前 続き)', cut: 1, fabric: 'outer',
      more: [{ fabric: 'lining', cut: 1 }, { fabric: 'interfacing', cut: 1 }],
      outline: rect(w, L), seam: 10, fold: null,
      grain: [[w * 0.12, F + h * 0.15], [w * 0.12, F + h * 0.6]],
      labelAt: [w / 2, F + h * 0.28],
      marks: [
        { type: 'line', pts: [[0, F], [w, F]], label: 'ふたの折り線' },
        { type: 'line', pts: [[0, F + h], [w, F + h]], label: '底の折り線' },
        { type: 'notch', at: [0, F] }, { type: 'notch', at: [w, F] },
        { type: 'notch', at: [0, F + h] }, { type: 'notch', at: [w, F + h] },
        note([w / 2, F * 0.62], 'ふた'),
        { type: 'dot', at: [w / 2, t] },
        note([w / 2, t + 5], `${snap}(裏布)`),
        note([w / 2, F + h + h * 0.62], '前'),
        { type: 'dot', at: [w / 2, L - (F - t)] },
        note([w / 2, L - (F - t) + 5], `${snap}(表布)`),
        { type: 'line', pts: [[w - 1, F + h + 8], [w - 1, F + h + 8 + Math.min(60, h - 12)]] },
        note([w - 14, F + h + 8 + Math.min(60, h - 12) / 2], '返し口'),
      ],
    };
    if (hasPocket) body.marks.push({ type: 'line', closed: true, pts: [[2, F + h - ph], [w - 2, F + h - ph], [w - 2, F + h - 2], [2, F + h - 2]], label: '(裏布だけ)ポケット' });
    const out = [body];
    if (hasPocket) {
      out.push({
        id: 'pocket', name: 'カードポケット', cut: 1, fabric: 'accent',
        outline: rect(w, ph), seam: 10, fold: 'top',
        grain: [[w * 0.12, ph * 0.25], [w * 0.12, ph * 0.8]],
        labelAt: [w / 2, ph * 0.45],
        marks: [note([w / 2, ph - 6], '下の縫い代は 裏へ折って 縫いつける')],
      });
    }
    return out;
  },

  matches(p) {
    const m = [{ label: '左わき と 右わき', a: { piece: 'body', from: 1, to: 2 }, b: { piece: 'body', from: 3, to: 0 } }];
    if (p.key !== 'S') m.push({ label: 'ポケットの幅 と 本体の幅', a: { piece: 'pocket', from: 2, to: 3 }, b: { piece: 'body', from: 0, to: 1 } });
    return m;
  },

  steps(p) {
    const pocket = p.key !== 'S';
    const snap = p.key === 'S' ? 'スナップ' : 'マグネットボタン';
    return [
      PRINT,
      cutStep('表布・裏布・接着芯を1枚ずつ', { more: pocket ? 'カードポケットは、布を折って「わ」に合わせ、1枚切ります。' : '' }),
      markStep(['合い印(▲)', 'ふたと底の折り線', `${snap}の付け位置(●)`, '返し口']),
      '表布の裏に、接着芯をアイロンではります。',
      ...(pocket ? ['カードポケットを「わ」で折り、下の縫い代を裏へ折ります。裏布の印に下のはしを縫いつけ、両わきは仮どめします。'] : []),
      `${snap}を、ふたの裏布と前の表布の、印の所に付けます。`,
      '表布と裏布を表どうしを内側にして重ね、まわりをぐるりと縫います。前の横に、返し口6cmを残します。',
      '角の縫い代をななめに切り、返し口から表に返して、アイロンで形をととのえます。',
      '底の折り線で前を上へ折り、両わきを、はしから3mmの所で縫います(返し口もいっしょにとじます)。',
      'ふたを折り線で折ったら、できあがりです。',
    ];
  },

  extras(p) {
    return [
      p.key === 'S' ? 'スナップボタン(縫いつけ) 1組' : 'マグネットボタン(うすいもの) 1組',
      '接着芯(ふつうの厚さ)',
    ];
  },
};

export const POUCH_BAGS = [poFlat, poBox, poMegane, poGama, poCard];

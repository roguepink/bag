# バッグの型紙アプリ(repo roguepink/bag)

ノブさんの依頼(2026-10-24): バッグの形を 3D で見て選ぶと、そのバッグの **型紙(原寸)** が出て、
家のプリンターで印刷できるアプリ。大きいバッグは **A4 を何枚かに分けて印刷 → 貼り合わせて型紙にする**。
- 市場調査をして、今どんなバッグがあり、何が流行っているかを調べ、その形の型紙を作る
- 型紙は多め: **30種類 × 大中小 = 90通り**(6つの仲間 × 5種類)
- 使う人は **お年寄り**。画面はとても単純に、文字は大きく、でも美しく洗練されたデザイン
- 柄(布の模様)を選べる。3D に柄がのる

公開リポジトリ。**写真・映画素材・個人情報・API キーは置かない。**
公開(GitHub Pages を有効にする)は **ノブさんに見せて OK をもらってから**。

## チーム(係)と持ちファイル — 自分の係のファイルだけ書く。git の commit はまとめ役だけ
| 係 | ファイル |
|---|---|
| 市場調査係 | `docs/research.md`, `data/bags-plan.json` |
| 型紙係 | `js/bags/*.js`, `js/geom.js`, `js/print.js` |
| 柄係 | `js/fabric.js` |
| 3D係 | `js/viewer3d.js` |
| デザイン係(画面) | `index.html`, `css/style.css`, `js/main.js`, `js/ui-*.js`, アイコン・manifest |
| 総合チェック係 | `tools/*`, `docs/review-*.md`(見つけた問題は持ち主の係に直してもらう) |

## 作り(ビルドなし)
- ES modules・ビルドなし。three.js r186 は `vendor/three/build/`(同梱・CDN なし)。importmap で `'three'`
- 画像・音のファイルは基本使わない。柄は canvas で描く、3D は寸法から作る
- 単位は **mm(ミリ)**。型紙の座標は y が下向き(SVG と同じ)
- 確認: `source ~/.local/venvs/ryokoshi/bin/activate && python3 tools/check.py`(総合チェック係が作る。headless Chrome・音なし)
  **Mac の画面をつけない・音を出さない**(ノブさんのルール)
- js を足したら `sw.js` の FILES に足して VERSION を上げる

## つなぎ方(API の約束)

### 型紙係 `js/bags/index.js`
```js
export const GROUPS = [ {id:'tote', name:'トートバッグ', icon:'…'}, … ]   // 6つ
export const BAGS = [ Bag, … ]                                             // 30
```
Bag:
```js
{
  id: 'tote-basic', name: 'まいにちトート', group: 'tote',
  level: 1,                 // 1 かんたん / 2 ふつう / 3 がんばる
  trend: true,              // 今はやっている形なら true
  desc: 'A4が入る、まいにち使えるトート。',   // 1〜2文。むずかしい言葉なし
  sizes: { S:{w,h,d,…}, M:{…}, L:{…} },      // できあがり寸法(mm)。中身は袋ごとに自由
  sizeNote: { S:'お弁当が入る', M:'A4が入る', L:'旅行にも' },
  shape(p) => Shape3D,      // 3D係に渡す形の説明(下)
  pieces(p) => Piece[],     // 型紙のパーツ
  steps(p) => string[],     // 作り方(短い文で 6〜12 手順)
  extras(p) => string[],    // 布以外に要るもの(例 'マグネットボタン 1組')
}
```
Piece:
```js
{
  id:'body', name:'本体', cut:2, fabric:'outer',   // outer 表布 / lining 裏布 / interfacing 接着芯 / accent 配色布
  outline: [[x,y],…],       // できあがり線(閉じた多角形・mm)。曲線は geom.js で点にしておく
  seam: 10,                 // 縫い代 mm(切る線 = できあがり線を外へ seam)。数値 or 辺ごとの配列
  fold: null | 'left'|'right'|'top'|'bottom',  // その辺が「わ」(布を折った線)。型紙は半分だけ
  grain: [[x1,y1],[x2,y2]], // 布目の矢印
  marks: [ {type:'notch',at:[x,y]}, {type:'dot',at:[x,y],label:'ポケット付け位置'},
           {type:'line',pts:[[x,y],…],label:'折り線'}, {type:'text',at:[x,y],text:'…'} ],
  measureOnly: false,       // true = 長い持ち手など。印刷せず「布に直接 線を引いて切る 〇cm×〇cm」と出す
}
```

### `js/geom.js`(型紙係)
`rect(w,h)` `roundRect(w,h,r)` `bezier(...)` `arc(...)` `offset(outline, seam)` `bbox(pts)` `length(pts)` など

### `js/print.js`(型紙係)
```js
layoutPieces(bag, sizeKey) => { sheetW, sheetH, items:[{piece, x, y, rotate}] }   // 全パーツを並べた原寸の大きな紙
overviewSVG(bag, sizeKey, {fabric}) => string           // 画面用の全体図(縮小。パーツ名・枚数・寸法入り)
printPages(bag, sizeKey, {paper:'A4'|'A3'}) => { pages:[svgString], cols, rows }  // 印刷用。1枚ずつ 210×297mm の SVG
materials(bag, sizeKey) => [{name:'表布', size:'幅110cm × 50cm'}, …]  // 用意する布の量(自動計算)
```
印刷ページの決まり: 原寸(100%)/ 紙の余白 10mm / となりのページと **のりしろ 10mm** 重ねる / ページ番号「A-1」/
合わせ印(◆)/ **1枚目に 5cm の四角**(測って 5cm なら OK)/ 「貼り方の図」(全体の中の何枚目か)

### 柄係 `js/fabric.js`
```js
export const FABRICS = [ {id:'plain', name:'むじ', group:'…'}, … ]     // 柄 20 前後(洋・和・北欧など)
export const COLORWAYS = [ {id:'navy', name:'こん', colors:['#…','#…','#…']}, … ]  // 色の組み 10 前後
drawFabric(ctx, fabricId, colorwayId, sizePx, scale=1)   // ctx に柄を1枚ぶん描く(つなぎ目なく並べられる)
fabricCanvas(fabricId, colorwayId, sizePx) => HTMLCanvasElement  // キャッシュつき
fabricThumb(fabricId, colorwayId, px) => dataURL         // 選ぶボタン用
```

### 3D係 `js/viewer3d.js`
```js
createViewer(containerEl) => {
  show(shape /*Shape3D*/, look /*{fabric, colorway, lining, strapColor}*/),
  setAutoRotate(bool), resize(), snapshot(px) => dataURL, dispose()
}
```
Shape3D(型紙係が bag.shape(p) で返す・mm):
```js
{ family: 'flat'|'boxed'|'gusset'|'cylinder'|'halfmoon'|'trapezoid'|'backpack'|'round'|'envelope'|'gathered'|'knot'|'azuma',
  w, h, d,                  // 幅・高さ・マチ(奥行き)
  topW,                     // 口の幅(台形・ギャザーのとき)
  corner,                   // 角の丸み mm
  flap: null | {h, shape:'square'|'round'|'point'},
  closure: null | 'zip'|'drawstring'|'snap'|'button'|'frame'|'tie',
  handles: [ {type:'loop'|'shoulder'|'cross'|'knot'|'cord'|'backpack'|'wrist', len, width} ],
  pocket: null | {w, h, side:'front'|'back'},
}
```
知らない family が来ても、近い形(boxed など)で出す。
あれば使う項目(なくてもよい): `strapAt`(持ち手の付け位置 mm・中心から)`zip:'top'|'around'` `bottom:'flat'|'round'`
`handleMaterial:'self'|'tape'|'leather'|'wood'` `band`(グラニーの口の帯の高さ)`knotShort`(むすびバッグの短い輪の大きさ)
`show()` は Promise を返す。`snapshot(px, {theta, phi})`。

### デザイン係(画面)
画面の流れ: **えらぶ(仲間 → バッグ)→ 見る(3D・大中小・柄)→ 型紙(全体図・用意するもの)→ 印刷 → 作り方**
- 文字は最小 20px、ボタンは高さ 64px 以上、1画面にボタンは少なく。戻るはいつも左上の大きな「もどる」
- 色は落ち着いて上品に。白地・濃い文字・はっきりした差(コントラスト)
- 言葉はやさしく(「パターン」→「型紙」、「シームアローワンス」→「縫い代」)

// 印刷: 印刷の前の案内(実際のサイズ・5cmの四角・貼り方)→ window.print()
import { esc, h, store, loadPrint, pickSize, SIZE_NAME, safe, toast } from './ui-common.js';

const ILL_PRINTER = `<svg class="ill" viewBox="0 0 320 180" role="img" aria-label="印刷の画面で「実際のサイズ」をえらぶ絵">
  <rect x="40" y="16" width="240" height="150" rx="12" fill="#fff" stroke="#c9bda8" stroke-width="2"/>
  <rect x="40" y="16" width="240" height="30" rx="12" fill="#e8edf3"/><rect x="40" y="34" width="240" height="12" fill="#e8edf3"/>
  <text x="60" y="37" font-size="15" font-weight="700" fill="#213b5c">印刷</text>
  <text x="60" y="72" font-size="14" fill="#5a5148">倍率・サイズ</text>
  <rect x="54" y="82" width="212" height="34" rx="8" fill="#e8edf3" stroke="#213b5c" stroke-width="3"/>
  <circle cx="74" cy="99" r="8" fill="#fff" stroke="#213b5c" stroke-width="2.5"/><circle cx="74" cy="99" r="4" fill="#213b5c"/>
  <text x="90" y="105" font-size="16" font-weight="700" fill="#213b5c">実際のサイズ(100%)</text>
  <circle cx="74" cy="138" r="8" fill="#fff" stroke="#b5aa98" stroke-width="2"/>
  <text x="90" y="144" font-size="15" fill="#8a8073">用紙に合わせる</text>
  <path d="M226 130l14 14M240 130l-14 14" stroke="#b0453a" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M276 92l18-10M276 104h22M276 116l18 10" stroke="#e0a43a" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const ILL_MEASURE = `<svg class="ill" viewBox="0 0 320 180" role="img" aria-label="5センチの四角を定規で測る絵">
  <rect x="40" y="14" width="150" height="150" fill="#fff" stroke="#c9bda8" stroke-width="2"/>
  <rect x="70" y="34" width="90" height="90" fill="none" stroke="#2b2622" stroke-width="2.5"/>
  <text x="115" y="84" font-size="20" font-weight="700" fill="#2b2622" text-anchor="middle">5cm</text>
  <g transform="translate(58 128)">
    <rect width="230" height="34" rx="4" fill="#f2d79a" stroke="#c9a85a" stroke-width="2"/>
    ${Array.from({ length: 13 }, (_, i) => `<path d="M${12 + i * 18} 0v${i % 2 ? 9 : 16}" stroke="#6b5420" stroke-width="2"/>`).join('')}
    <text x="12" y="30" font-size="11" fill="#6b5420" text-anchor="middle">0</text>
    <text x="102" y="30" font-size="11" fill="#6b5420" text-anchor="middle">5</text>
  </g>
  <path d="M70 128v-8M160 128v-8" stroke="#213b5c" stroke-width="3"/>
  <circle cx="250" cy="66" r="30" fill="#e8edf3"/><path d="M236 66l10 10 20-22" fill="none" stroke="#213b5c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ILL_GLUE = `<svg class="ill" viewBox="0 0 320 180" role="img" aria-label="となりの紙を、ひし形の印が合うように重ねて貼る絵">
  <rect x="34" y="22" width="130" height="140" fill="#fff" stroke="#c9bda8" stroke-width="2"/>
  <text x="54" y="50" font-size="15" font-weight="700" fill="#213b5c">A-1</text>
  <rect x="140" y="22" width="24" height="140" fill="#e8edf3"/>
  <rect x="146" y="30" width="130" height="140" fill="#fff" stroke="#213b5c" stroke-width="2" opacity=".96" transform="rotate(-2 146 30)"/>
  <text x="196" y="60" font-size="15" font-weight="700" fill="#213b5c">A-2</text>
  <path d="M152 80l8 8-8 8-8-8z" fill="#213b5c"/><path d="M152 126l8 8-8 8-8-8z" fill="#213b5c"/>
  <path d="M60 110c30-14 70-14 90 0" fill="none" stroke="#2b2622" stroke-width="2" stroke-dasharray="5 5"/>
  <rect x="132" y="60" width="38" height="14" rx="2" fill="#f7e9b9" opacity=".9" transform="rotate(-8 151 67)"/>
  <rect x="132" y="146" width="38" height="14" rx="2" fill="#f7e9b9" opacity=".9" transform="rotate(6 151 153)"/>
</svg>`;

const PC_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="7" width="30" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M2 32h36" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;

export async function renderPrint(root, { bag, go, isStale }) {
  const size = pickSize(bag, store.get('size'));
  const paper = store.get('paper') === 'A3' ? 'A3' : 'A4';
  const pr = await loadPrint();
  if (isStale()) return;
  const res = pr && typeof pr.printPages === 'function' ? safe(() => pr.printPages(bag, size, { paper }), null) : null;
  const pages = (res && Array.isArray(res.pages)) ? res.pages : [];
  const pieces = typeof bag.pieces === 'function' ? safe(() => bag.pieces({ ...(bag.sizes && bag.sizes[size]), key: size, size, sizeKey: size }), []) || [] : [];
  if (pieces.length && pieces.every((pc) => pc && pc.measureOnly)) {
    root.innerHTML = `<div class="page-head"><p class="kicker">印刷</p><h1>印刷はいりません</h1>
      <p class="lead">${esc(bag.name)}は、型紙を印刷しなくても作れます。布に直接 線を引いて切ります。</p></div>
      <div class="btn-row"><button class="btn btn-primary btn-block" type="button" id="to-steps">作り方へすすむ<span class="arrow" aria-hidden="true">›</span></button></div>`;
    root.querySelector('#to-steps').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/steps`));
    return;
  }
  const cols = (res && res.cols) || pages.length || 1;
  const rows = (res && res.rows) || 1;

  // 貼り方の地図(使わない場所は空ける)
  const grid = (res && Array.isArray(res.map)) ? res.map
    : Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `${String.fromCharCode(65 + r)}-${c + 1}`));
  const map = grid.map((row) => row.map((l) => (l ? `<span>${esc(l)}</span>` : '<span class="blank"></span>')).join('')).join('');

  root.innerHTML = `
    <div class="page-head">
      <p class="kicker">印刷</p>
      <h1>印刷のまえに</h1>
      <p class="lead">${esc(bag.name)}(${SIZE_NAME[size]})の型紙を、${paper}の紙${pages.length ? ` <b>${pages.length}枚</b>` : ''}に印刷します。3つだけ、たしかめてください。</p>
    </div>
    <div class="guide">
      <div class="guide-card">
        <h3>「実際のサイズ」をえらぶ</h3>
        ${ILL_PRINTER}
        <p>印刷の画面で、<strong>「実際のサイズ」</strong>か<strong>「100%」</strong>をえらんでください。</p>
        <p class="muted small">「用紙に合わせる」だと、型紙が小さくなってしまいます。</p>
      </div>
      <div class="guide-card">
        <h3>5cmの四角を測る</h3>
        ${ILL_MEASURE}
        <p>1枚目に四角があります。定規で測って<strong>ちょうど5cm</strong>なら、正しい大きさです。</p>
        <p class="muted small">ちがうときは、1の設定をもう一度見てください。</p>
      </div>
      <div class="guide-card">
        <h3>番号の順に貼る</h3>
        ${ILL_GLUE}
        <p>紙のすみの番号の順に並べ、<strong>◆の印</strong>どうしを重ねてテープで貼ります。</p>
        ${pages.length > 1 ? `<div class="page-map-wrap"><div class="page-map" style="grid-template-columns:repeat(${cols}, minmax(40px, 58px))" aria-label="紙の並べ方">${map}</div></div>` : ''}
      </div>
    </div>
    <div class="tip">${PC_SVG}<p>パソコンなら、印刷の画面で<strong>「PDFとして保存」</strong>をえらぶと、コンビニのコピー機でも印刷できます。</p></div>
    ${pages.length ? '' : `<div class="notice">型紙の印刷は、ただいま準備中です。</div>`}
    <div class="btn-row">
      <button class="btn btn-primary btn-block" type="button" id="print-all" ${pages.length ? '' : 'disabled'}>
        <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        ${pages.length ? `${pages.length}枚 印刷する` : '印刷する'}</button>
      ${pages.length > 1 ? `<button class="btn btn-block" type="button" id="print-one">ためしに1枚だけ印刷</button>` : ''}
      <button class="btn btn-block" type="button" id="to-steps" style="border-style:dashed">作り方へすすむ<span class="arrow" aria-hidden="true">›</span></button>
    </div>`;

  const area = document.getElementById('print-area');
  const doPrint = (list) => {
    if (!list.length) return;
    document.getElementById('page-size').textContent = `@page { size: ${paper}; margin: 0; }`;
    area.className = paper === 'A3' ? 'a3' : '';
    area.innerHTML = list.map((svg) => `<div class="print-page">${svg}</div>`).join('');
    const done = () => { area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    // 絵が入るのを待ってから
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { window.print(); } catch (e) { toast('この画面からは印刷できませんでした'); }
    }));
  };
  root.querySelector('#print-all').addEventListener('click', () => doPrint(pages));
  const one = root.querySelector('#print-one');
  if (one) one.addEventListener('click', () => doPrint(pages.slice(0, 1)));
  root.querySelector('#to-steps').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/steps`));

  return () => { area.innerHTML = ''; };
}

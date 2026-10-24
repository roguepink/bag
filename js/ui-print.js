// 印刷: 印刷の前の案内(実際のサイズ・5cmの四角・貼り方)→ window.print()
import { phraseHTML, esc, h, store, loadPrint, pickSize, paramsOf, SIZE_NAME, safe, toast } from './ui-common.js';

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

const PC_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="24" rx="2.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M2 39h44" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
const PHONE_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="4" width="22" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M21 38h6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
const STORE_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 18l4-10h28l4 10z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M9 18v22h30V18" fill="none" stroke="currentColor" stroke-width="3"/><rect x="19" y="27" width="10" height="13" fill="none" stroke="currentColor" stroke-width="3"/></svg>`;
const PRINT_ICON = `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

const ILL_PHONE = `<svg class="ill" viewBox="0 0 320 180" role="img" aria-label="スマホの印刷の画面で、用紙をA4、倍率を100%にする絵">
  <rect x="104" y="8" width="112" height="166" rx="16" fill="#fff" stroke="#c9bda8" stroke-width="2.5"/>
  <text x="160" y="36" font-size="13" font-weight="700" fill="#213b5c" text-anchor="middle">印刷</text>
  <rect x="116" y="48" width="88" height="30" rx="6" fill="#e8edf3" stroke="#213b5c" stroke-width="2.5"/>
  <text x="124" y="68" font-size="12" fill="#2b2622">用紙</text><text x="196" y="68" font-size="14" font-weight="700" fill="#213b5c" text-anchor="end">A4</text>
  <rect x="116" y="86" width="88" height="30" rx="6" fill="#e8edf3" stroke="#213b5c" stroke-width="2.5"/>
  <text x="124" y="106" font-size="12" fill="#2b2622">倍率</text><text x="196" y="106" font-size="14" font-weight="700" fill="#213b5c" text-anchor="end">100%</text>
  <rect x="124" y="136" width="72" height="24" rx="12" fill="#213b5c"/><text x="160" y="153" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">印刷</text>
  <path d="M222 62h22M222 100h22" stroke="#e0a43a" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const ROUTES = [
  { id: 'pc', name: 'パソコンとプリンター', icon: PC_SVG },
  { id: 'phone', name: 'スマホとプリンター', icon: PHONE_SVG },
  { id: 'store', name: 'コンビニで印刷', icon: STORE_SVG },
];
const ua = navigator.userAgent || '';
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const guessRoute = () => (isIOS || isAndroid ? 'phone' : 'pc');

function routeGuide(route, phoneOS) {
  if (route === 'pc') {
    return `<div class="guide-card">
      <h3>「実際のサイズ」をえらぶ</h3>
      ${ILL_PRINTER}
      <p>下のボタンを押すと、印刷の画面が出ます。<strong>「実際のサイズ」</strong>か<strong>「100%」</strong>をえらんでください。</p>
      <p class="muted small">「用紙に合わせる」だと、型紙が小さくなってしまいます。</p>
    </div>`;
  }
  if (route === 'phone') {
    const android = `<p>下のボタンを押すと、印刷の画面が出ます。</p>
      <ol class="how">
        <li>上の<strong>「プリンタを選択」</strong>で、家のプリンターをえらびます。</li>
        <li><strong>「用紙サイズ」</strong>を<strong>A4</strong>にします(⌄ を押すと出ます)。</li>
        <li><strong>「倍率」</strong>や<strong>「拡大/縮小」</strong>があれば、<strong>100%(なし)</strong>にします。</li>
      </ol>`;
    const iphone = `<p>下のボタンを押すと、印刷の画面(プリントオプション)が出ます。</p>
      <ol class="how">
        <li><strong>「プリンタ」</strong>で、家のプリンターをえらびます。</li>
        <li><strong>「用紙サイズ」</strong>を<strong>A4</strong>にします。</li>
        <li>iPhone には倍率をえらぶ所が<strong>ないことが多い</strong>ので、そのまま1枚だけ印刷して、5cmを測ってください。</li>
      </ol>`;
    return `<div class="guide-card">
      <h3>用紙をA4、倍率を100%に</h3>
      ${ILL_PHONE}
      <div class="os-tabs" role="group" aria-label="スマホの種類">
        <button type="button" class="os-btn" data-os="android" aria-pressed="${phoneOS === 'android'}">Android</button>
        <button type="button" class="os-btn" data-os="iphone" aria-pressed="${phoneOS === 'iphone'}">iPhone</button>
      </div>
      ${phoneOS === 'iphone' ? iphone : android}
    </div>`;
  }
  return `<div class="guide-card">
    <h3>PDFにしてコンビニで</h3>
    <ol class="how">
      <li>下のボタンを押し、印刷の画面で<strong>「PDFとして保存」</strong>をえらびます(iPhone は 共有 → 「ファイルに保存」)。</li>
      <li>コンビニの印刷のアプリ(ネットプリントなど)に、そのPDFを入れます。</li>
      <li>お店のコピー機で、<strong>「A4」</strong>と<strong>「等倍(100%)」</strong>をえらんで印刷します。</li>
    </ol>
    <p class="muted small">コンビニなら A3 でも印刷できます。</p>
  </div>`;
}

export async function renderPrint(root, { bag, go, isStale }) {
  const size = pickSize(bag, store.get('size'));
  const pr = await loadPrint();
  if (isStale()) return;
  const pieces = typeof bag.pieces === 'function' ? (safe(() => bag.pieces(paramsOf(bag, size)), []) || []) : [];
  const noPattern = pieces.length > 0 && pieces.every((pc) => pc && pc.measureOnly);
  const counts = {};
  const results = {};
  for (const pp of ['A4', 'A3']) {
    const r = pr && typeof pr.printPages === 'function' ? safe(() => pr.printPages(bag, size, { paper: pp }), null) : null;
    results[pp] = r; counts[pp] = r && Array.isArray(r.pages) ? r.pages.length : 0;
  }
  const hp = pr && typeof pr.hasPattern === 'function' ? safe(() => pr.hasPattern(bag, size), null) : null;
  const hasPattern = hp === null ? (!noPattern && !(results.A4 && results.A4.hasPattern === false)) : !!hp;
  const sizeName = (pr && pr.SIZE_LABEL && pr.SIZE_LABEL[size]) || SIZE_NAME[size];

  let route = store.get('printRoute') || guessRoute();
  let phoneOS = isIOS ? 'iphone' : 'android';
  let stage = 'start'; // start → asked(5cmでしたか)
  const area = document.getElementById('print-area');

  const draw = () => {
    const paper = store.get('paper') === 'A3' ? 'A3' : 'A4';
    const res = results[paper];
    const pages = (res && Array.isArray(res.pages)) ? res.pages : [];
    const cols = (res && res.cols) || pages.length || 1;
    const rows = (res && res.rows) || 1;
    const grid = (res && Array.isArray(res.map)) ? res.map
      : Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `${String.fromCharCode(65 + r)}-${c + 1}`));
    const map = grid.map((row) => row.map((l) => (l ? `<span>${esc(l)}</span>` : '<span class="blank">紙なし</span>')).join('')).join('');

    if (!hasPattern) {
      root.innerHTML = `<div class="page-head"><p class="kicker">印刷</p><h1>印刷はいりません</h1>
        <p class="lead">${esc(bag.name)}は、型紙を印刷しなくても作れます。型紙の画面の寸法どおりに、布に直接、線を引いて切ります。</p></div>
        <div class="btn-row">
          <button class="btn btn-primary btn-block" type="button" id="to-steps">作り方へすすむ<span class="arrow" aria-hidden="true">›</span></button>
          ${pages.length ? `<button class="btn btn-block" type="button" id="print-memo">${PRINT_ICON}寸法の紙を1枚印刷する</button>` : ''}
        </div>`;
      root.querySelector('#to-steps').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/steps`));
      const memo = root.querySelector('#print-memo');
      if (memo) memo.addEventListener('click', () => doPrint(pages.slice(0, 1), paper));
      return;
    }

    const rest = Math.max(0, pages.length - 1);
    root.innerHTML = `
      <div class="page-head">
        <p class="kicker">印刷</p>
        <h1>印刷のしかた</h1>
        <p class="lead">${esc(bag.name)}(${esc(sizeName)})の型紙を、<b>${paper}の紙${pages.length ? `${pages.length}枚` : ''}</b>に印刷します。</p>
      </div>
      <div class="paper-mini" role="group" aria-label="紙の大きさ">
        ${['A4', 'A3'].map((pp) => `<button type="button" class="paper-chip" data-paper="${pp}" aria-pressed="${pp === paper}">${pp}${counts[pp] ? `で${counts[pp]}枚` : ''}</button>`).join('')}
      </div>
      ${paper === 'A3' ? '<p class="muted small" style="margin:6px 0 0">A3は、家のプリンターがA3に対応しているときだけ。コンビニならA3でも印刷できます。</p>' : ''}

      ${navigator.standalone ? '<div class="notice">ホーム画面から開いたときは、印刷できないことがあります。そのときは Safari でこのページを開いて印刷してください。</div>' : ''}
      <section class="section">
        <h2>どれで印刷しますか</h2>
        <div class="route-choice" role="group" aria-label="印刷のしかた">
          ${ROUTES.map((r) => `<button type="button" class="route-btn" data-route="${r.id}" aria-pressed="${r.id === route}">${r.icon}<span>${phraseHTML(r.name)}</span></button>`).join('')}
        </div>
      </section>

      <div class="guide" style="margin-top:22px">
        ${routeGuide(route, phoneOS)}
        <div class="guide-card">
          <h3>5cmの四角を測る</h3>
          ${ILL_MEASURE}
          <p>1枚目に四角があります。定規で測って<strong>ちょうど5cm</strong>なら、正しい大きさです。</p>
          <p class="muted small">ちがうときは、上の設定をもう一度見てください。</p>
        </div>
        <div class="guide-card">
          <h3>番号の順に貼る</h3>
          ${ILL_GLUE}
          <p>紙のすみの番号の順に並べます。<strong>1枚目は切りません。</strong></p>
          <p><strong>2枚目からは、白いふちを点線で切り</strong>、となりの紙の<strong>ななめの線(のりしろ)</strong>に重ねて、<strong>◆</strong>どうしを合わせてテープで貼ります。</p>
          ${pages.length > 1 ? `<div class="page-map-wrap"><div class="page-map" style="grid-template-columns:repeat(${cols}, minmax(44px, 62px))" aria-label="紙の並べ方">${map}</div></div>` : ''}
        </div>
      </div>
      ${pages.length ? '' : `<div class="notice">型紙の印刷は、ただいま準備中です。</div>`}

      <div class="print-actions" id="actions">
        ${stage === 'start' || !rest ? `
          <button class="btn btn-primary btn-block" type="button" id="print-one" ${pages.length ? '' : 'disabled'}>${PRINT_ICON}${rest ? 'まず1枚だけ印刷する' : '印刷する'}</button>
          ${rest ? '<p class="muted small center">1枚目には、5cmの四角があります。</p>' : ''}
        ` : `
          <div class="ask">
            <p class="ask-q">5cmでしたか?</p>
            <button class="btn btn-primary btn-block" type="button" id="print-rest">${PRINT_ICON}はい、残りの${rest}枚を印刷する</button>
            <p class="muted small center">2枚目から印刷します。</p>
            <button class="btn btn-block" type="button" id="not-5">いいえ、ちがった</button>
            <button class="btn btn-block" type="button" id="again" style="border-style:dashed">もう一度、1枚目を印刷する</button>
          </div>
        `}
        <button class="btn btn-block" type="button" id="to-steps" style="border-style:dashed;margin-top:14px">作り方へすすむ<span class="arrow" aria-hidden="true">›</span></button>
      </div>`;

    root.querySelectorAll('[data-paper]').forEach((b) => b.addEventListener('click', () => { store.set('paper', b.dataset.paper); stage = 'start'; draw(); }));
    root.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => { route = b.dataset.route; store.set('printRoute', route); draw(); }));
    root.querySelectorAll('[data-os]').forEach((b) => b.addEventListener('click', () => { phoneOS = b.dataset.os; draw(); }));
    const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('#print-one', () => {
      doPrint(pages.slice(0, 1), paper);
      if (rest) { stage = 'asked'; setTimeout(() => { draw(); focusAsk(); }, 400); }
    });
    on('#again', () => doPrint(pages.slice(0, 1), paper));
    on('#print-rest', () => doPrint(pages.slice(1), paper));
    on('#not-5', () => {
      toast('印刷の画面の「倍率」を100%(実際のサイズ)にして、もう一度ためしてください', 5000);
      const g = root.querySelector('.guide'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    on('#to-steps', () => go(`b/${encodeURIComponent(bag.id)}/steps`));
  };
  const focusAsk = () => { const a = root.querySelector('.ask'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const doPrint = (list, paper) => {
    if (!list.length) return;
    document.getElementById('page-size').textContent = `@page { size: ${paper}; margin: 0; }`;
    area.className = paper === 'A3' ? 'a3' : '';
    area.innerHTML = list.map((svg) => `<div class="print-page">${svg}</div>`).join('');
    const done = () => { area.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { window.print(); } catch (e) { toast('この画面からは印刷できませんでした'); }
    }));
  };

  draw();
  return () => { area.innerHTML = ''; };
}

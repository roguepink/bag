// 型紙: 全体図(拡大できる)・パーツの一覧・用意するもの・紙の枚数
import {
  phraseHTML, esc, h, store, loadPrint, paramsOf, pickSize, SIZE_NAME, dimHTML, cm, safe, currentLook,
} from './ui-common.js';

const FABRIC_NAME = { outer: '表布', lining: '裏布', interfacing: '接着芯', accent: '配色布' };
const FABRIC_HELP = {
  '配色布': 'ポケットなどに使う、ちがう色の布。表布と同じでもよい',
  '接着芯': 'アイロンではって、布をしっかりさせる布',
};
const TOOLS = ['布切りばさみ', '紙用のはさみ', 'チャコペン(布に印をつけるペン)', '待ち針', '定規(50cmくらい)', 'アイロン', 'ミシン糸(布に合う色)', '型紙を貼るセロハンテープ'];
const NUM = ['❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿', '⓫', '⓬', '⓭', '⓮', '⓯', '⓰', '⓱', '⓲', '⓳', '⓴'];
const PRINT_ICON = `<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

export async function renderPattern(root, { bag, go, isStale }) {
  const size = pickSize(bag, store.get('size'));
  const p = paramsOf(bag, size);
  const pr = await loadPrint();
  const look = await currentLook();
  if (isStale()) return;
  const pieces = (typeof bag.pieces === 'function' ? safe(() => bag.pieces(p), []) : []) || [];
  const hp = pr && typeof pr.hasPattern === 'function' ? safe(() => pr.hasPattern(bag, size), null) : null;
  const noPattern = hp === null ? (pieces.length > 0 && pieces.every((pc) => pc && pc.measureOnly)) : !hp;
  const hasFold = pieces.some((pc) => pc && pc.fold && !pc.measureOnly);

  root.innerHTML = `
    <div class="page-head">
      <p class="kicker">型紙</p>
      <h1>${phraseHTML(bag.name)} <span class="size-tag">${SIZE_NAME[size]}</span></h1>
      <p class="lead">できあがり ${dimHTML(bag, size)}</p>
    </div>
    <button class="overview" type="button" id="ov" aria-label="型紙の全体図。押すと大きく見られます">
      <div class="svgbox" id="ov-box"></div>
      <span class="zoom-tag"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M15 15l5.5 5.5M7 10h6M10 7v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>大きく見る</span>
    </button>
    ${noPattern ? '' : `<ul class="legend" aria-label="線の見かた">
      <li><span class="ln cut" aria-hidden="true"></span>いちばん外の太い線…ここで切る</li>
      <li><span class="ln sew" aria-hidden="true"></span>内側の細い線…縫う線(できあがり)</li>
      ${hasFold ? '<li><span class="ln fold" aria-hidden="true"></span>赤い点線…わ(布を折って置く。切らない)</li>' : ''}
    </ul>`}

    <section class="section">
      <h2>パーツ</h2>
      <ol class="parts" id="parts"></ol>
    </section>

    <section class="section">
      <h2>用意するもの</h2>
      <ul class="mat-list" id="mats"></ul>
      <ul class="mat-list extras" id="extras" style="margin-top:12px"></ul>
      <h3 class="tools-h">いつも使う道具</h3>
      <ul class="tools" id="tools"></ul>
    </section>

    <section class="section" id="paper-sec">
      <h2>印刷する紙</h2>
      <div class="paper-choice" id="papers" role="group" aria-label="紙の大きさ"></div>
      <p class="sheet-count" id="count" aria-live="polite"></p>
    </section>

    <div class="btn-row two">
      <button class="btn btn-primary btn-block" type="button" id="to-print">${PRINT_ICON}印刷する</button>
      <button class="btn btn-block" type="button" id="to-steps">作り方を見る<span class="arrow" aria-hidden="true">›</span></button>
    </div>`;
  root.querySelector('#to-print').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/print`));
  root.querySelector('#to-steps').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/steps`));

  // ---- 全体図(図の中は番号と名前だけ。一覧は下の HTML) ----
  const ovBox = root.querySelector('#ov-box');
  const svg = pr && typeof pr.overviewSVG === 'function'
    ? safe(() => pr.overviewSVG(bag, size, { fabric: look.fabric, colorway: look.colorway, list: false, legend: false }), '') : '';
  if (svg) {
    ovBox.innerHTML = svg;
    root.querySelector('#ov').addEventListener('click', () => openZoom(svg));
  } else {
    ovBox.innerHTML = `<p class="muted" style="padding:40px 10px">全体図は、ただいま準備中です。</p>`;
    root.querySelector('#ov .zoom-tag').remove();
  }

  // ---- パーツの一覧 ----
  const partsEl = root.querySelector('#parts');
  partsEl.innerHTML = pieces.filter(Boolean).map((pc, k) => {
    const cuts = (pr && typeof pr.cutsOf === 'function') ? safe(() => pr.cutsOf(pc), null) : null;
    const list = cuts || [{ fabric: pc.fabric || 'outer', cut: pc.cut ?? 1 }];
    const unit = pc.unit || (pc.measureOnly ? '本' : '枚');
    const count = list.map((c) => `${FABRIC_NAME[c.fabric] || c.fabric}${c.cut}${unit}`).join('・');
    let size2;
    if (pc.measureOnly) {
      const [w, hh] = cutSize(pc);
      size2 = `型紙なし。布に直接、線を引いて <b class="nw">${cm(w)} × ${cm(hh)}cm</b> に切る`;
    } else {
      const fs = (pr && typeof pr.finishedSize === 'function') ? safe(() => pr.finishedSize(pc), null) : null;
      const [w, hh] = fs || finished(pc);
      size2 = `できあがり <span class="nw">${cm(w)} × ${cm(hh)}cm</span>${pc.fold ? '(わで切ると この大きさ)' : ''}`;
    }
    return `<li><span class="no" aria-hidden="true">${NUM[k] || k + 1}</span><div>
      <p class="pn">${esc(pc.name)}<span class="pc">${esc(count)}</span></p>
      <p class="ps">${size2}</p>${pc.measureOnly && pc.note ? `<p class="ps muted">${esc(pc.note)}</p>` : ''}</div></li>`;
  }).join('') || `<li><span class="muted">パーツは、ただいま準備中です。</span></li>`;

  // ---- 用意するもの ----
  const mats = (pr && typeof pr.materials === 'function') ? safe(() => pr.materials(bag, size), []) : [];
  const matsEl = root.querySelector('#mats');
  if (mats && mats.length) {
    matsEl.innerHTML = mats.map((m) => {
      const help = FABRIC_HELP[m.name];
      return `<li><span class="mn">${esc(m.name)}</span><span class="ms">${esc(m.size || '')}</span>${help ? `<span class="cut-note">${esc(m.name)}…${esc(help)}</span>` : ''}${m.note ? `<span class="cut-note">${esc(m.note)}</span>` : ''}</li>`;
    }).join('');
  } else {
    matsEl.innerHTML = `<li><span class="muted">布の量は、ただいま計算の準備中です。</span></li>`;
  }
  const extras = (typeof bag.extras === 'function' ? safe(() => bag.extras(p), []) : []) || [];
  const exEl = root.querySelector('#extras');
  if (extras.length) exEl.innerHTML = extras.map((t) => `<li><span class="mn">${esc(t)}</span></li>`).join('');
  else exEl.remove();
  const tools = TOOLS.filter((t) => !extras.some((e) => String(e).includes(t.slice(0, 3))));
  root.querySelector('#tools').innerHTML = tools.map((t) => `<li>${esc(t)}</li>`).join('');

  // ---- 紙 ----
  const papersEl = root.querySelector('#papers');
  const countEl = root.querySelector('#count');
  const counts = {};
  for (const paper of ['A4', 'A3']) {
    const r = pr && typeof pr.printPages === 'function' ? safe(() => pr.printPages(bag, size, { paper }), null) : null;
    counts[paper] = r && r.pages ? r.pages.length : null;
  }
  let paper = store.get('paper') === 'A3' ? 'A3' : 'A4';
  const drawPapers = () => {
    papersEl.innerHTML = '';
    for (const pp of ['A4', 'A3']) {
      const n = counts[pp];
      const b = h(`<button class="paper-btn ${pp.toLowerCase()}" type="button" aria-pressed="${pp === paper}">
        <span class="sheet" aria-hidden="true"></span>
        <span><span class="pn">${pp}</span><span class="pc">${n ? `${n}枚` : pp === 'A4' ? 'ふつうの紙' : '大きい紙'}</span></span></button>`);
      b.addEventListener('click', () => { paper = pp; store.set('paper', pp); drawPapers(); });
      papersEl.appendChild(b);
    }
    const n = counts[paper];
    countEl.innerHTML = n
      ? `${paper}の紙で<b>${n}</b>枚印刷して、貼り合わせます。${paper === 'A3' ? '<br><span class="muted small">A3は、プリンターが対応しているときだけ。</span>' : ''}`
      : `<span class="muted">紙の枚数は、ただいま準備中です。</span>`;
  };
  drawPapers();

  // 型紙を印刷しなくてよい袋(パーツが全部「線を引いて切る」)
  if (noPattern) {
    root.querySelector('#paper-sec').innerHTML = `<h2>印刷はいりません</h2>
      <div class="tip" style="margin-top:0"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 30L30 6l4 4L10 34H6z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M26 10l4 4" stroke="currentColor" stroke-width="2.6"/></svg>
      <p>この袋は、型紙を印刷しなくても作れます。上の寸法どおりに、定規で布に直接、線を引いて切ってください。</p></div>`;
    root.querySelector('#to-print').remove();
    const ts = root.querySelector('#to-steps');
    ts.classList.add('btn-primary');
    ts.parentElement.classList.remove('two');
  }
}

function finished(pc) {
  const pts = pc.outline || [];
  if (!pts.length) return [0, 0];
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  let w = Math.max(...xs) - Math.min(...xs), hh = Math.max(...ys) - Math.min(...ys);
  if (pc.fold === 'left' || pc.fold === 'right') w *= 2;
  if (pc.fold === 'top' || pc.fold === 'bottom') hh *= 2;
  return [w, hh];
}

function cutSize(pc) {
  const pts = pc.outline || [];
  if (!pts.length) return [0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const s = Array.isArray(pc.seam) ? Math.max(...pc.seam) : (Number(pc.seam) || 0);
  let w = x1 - x0 + s * 2;
  let hgt = y1 - y0 + s * 2;
  if (pc.fold === 'left' || pc.fold === 'right') w = (x1 - x0) * 2 + s * 2;
  if (pc.fold === 'top' || pc.fold === 'bottom') hgt = (y1 - y0) * 2 + s * 2;
  return [w, hgt];
}

// ---- 大きく見る ----
function openZoom(svg) {
  let z = 1;
  const el = h(`<div class="zoomer" role="dialog" aria-modal="true" aria-label="型紙の全体図">
    <div class="zoomer-bar">
      <button class="back" type="button" data-close><span class="back-arrow" aria-hidden="true">‹</span><span>とじる</span></button>
      <span class="sp"></span>
      <button class="zbtn" type="button" data-z="-1" aria-label="小さく">−</button>
      <button class="zbtn" type="button" data-z="1" aria-label="大きく">＋</button>
    </div>
    <div class="zoomer-body"><div class="svgbox">${svg}</div></div></div>`);
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
  const box = el.querySelector('.svgbox');
  const s = box.querySelector('svg');
  const apply = () => {
    if (!s) return;
    const base = el.querySelector('.zoomer-body').clientWidth - 32;
    s.style.width = `${Math.round(base * z)}px`;
    s.style.maxWidth = 'none';
  };
  apply();
  const close = () => { el.remove(); document.body.style.overflow = ''; window.removeEventListener('hashchange', close); };
  el.querySelector('[data-close]').addEventListener('click', close);
  window.addEventListener('hashchange', close);
  el.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
    z = Math.min(4, Math.max(1, z * (b.dataset.z === '1' ? 1.5 : 1 / 1.5)));
    apply();
  }));
  el.querySelector('[data-close]').focus();
}

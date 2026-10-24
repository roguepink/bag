// 型紙: 全体図(拡大できる)・用意するもの・紙の枚数
import {
  esc, h, store, loadPrint, paramsOf, pickSize, SIZE_NAME, dimText, cm, safe, currentLook,
} from './ui-common.js';

const FABRIC_NAME = { outer: '表布', lining: '裏布', interfacing: '接着芯', accent: '配色布' };

export async function renderPattern(root, { bag, go, isStale }) {
  const size = pickSize(bag, store.get('size'));
  const p = paramsOf(bag, size);
  const pr = await loadPrint();
  const look = await currentLook();
  if (isStale()) return;

  root.innerHTML = `
    <div class="page-head">
      <p class="kicker">型紙</p>
      <h1>${esc(bag.name)}<span class="muted" style="font-size:.6em">(${SIZE_NAME[size]})</span></h1>
      <p class="lead">できあがり ${esc(dimText(bag, size))}</p>
    </div>
    <button class="overview" type="button" id="ov" aria-label="型紙の全体図。押すと大きく見られます">
      <div class="svgbox" id="ov-box"></div>
      <span class="zoom-tag"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M15 15l5.5 5.5M7 10h6M10 7v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>大きく見る</span>
    </button>

    <section class="section">
      <h2>用意するもの</h2>
      <ul class="mat-list" id="mats"></ul>
      <ul class="mat-list extras" id="extras" style="margin-top:12px"></ul>
    </section>

    <section class="section" id="cut-sec" hidden>
      <h2>布に直接 線を引いて切るもの</h2>
      <p class="muted" style="margin:-4px 0 12px">長いものは印刷しません。定規で布に線を引いて切ります(縫い代こみ)。</p>
      <ul class="mat-list" id="cuts"></ul>
    </section>

    <section class="section">
      <h2>印刷する紙</h2>
      <div class="paper-choice" id="papers" role="group" aria-label="紙の大きさ"></div>
      <p class="sheet-count" id="count" aria-live="polite"></p>
    </section>

    <div class="btn-row two">
      <button class="btn btn-primary btn-block" type="button" id="to-print">
        <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        印刷する</button>
      <button class="btn btn-block" type="button" id="to-steps">作り方を見る<span class="arrow" aria-hidden="true">›</span></button>
    </div>`;
  root.querySelector('#to-print').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/print`));
  root.querySelector('#to-steps').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/steps`));

  // ---- 全体図 ----
  const ovBox = root.querySelector('#ov-box');
  const svg = pr && typeof pr.overviewSVG === 'function'
    ? safe(() => pr.overviewSVG(bag, size, { fabric: look.fabric, colorway: look.colorway }), '') : '';
  if (svg) {
    ovBox.innerHTML = svg;
    root.querySelector('#ov').addEventListener('click', () => openZoom(svg));
  } else {
    ovBox.innerHTML = `<p class="muted" style="padding:40px 10px">全体図は、ただいま準備中です。</p>`;
    root.querySelector('#ov .zoom-tag').remove();
  }

  // ---- 用意するもの ----
  const mats = (pr && typeof pr.materials === 'function') ? safe(() => pr.materials(bag, size), []) : [];
  const matsEl = root.querySelector('#mats');
  if (mats && mats.length) {
    matsEl.innerHTML = mats.map((m) => `<li><span class="mn">${esc(m.name)}</span><span class="ms">${esc(m.size || '')}</span>${m.note ? `<span class="cut-note">${esc(m.note)}</span>` : ''}</li>`).join('');
  } else {
    matsEl.innerHTML = `<li><span class="muted">布の量は、ただいま計算の準備中です。</span></li>`;
  }
  const extras = typeof bag.extras === 'function' ? safe(() => bag.extras(p), []) : [];
  const exEl = root.querySelector('#extras');
  const always = ['ミシン糸(布に合う色)', '型紙を貼るセロハンテープ'];
  const list = [...(extras || [])];
  for (const a of always) if (!list.some((t) => String(t).includes(a.slice(0, 3)))) list.push(a);
  exEl.innerHTML = list.map((t) => `<li><span class="mn">${esc(t)}</span></li>`).join('');

  // ---- 線を引いて切るもの(measureOnly) ----
  const pieces = typeof bag.pieces === 'function' ? safe(() => bag.pieces(p), []) : [];
  const cuts = (pieces || []).filter((pc) => pc && pc.measureOnly);
  if (cuts.length) {
    root.querySelector('#cut-sec').hidden = false;
    root.querySelector('#cuts').innerHTML = cuts.map((pc) => {
      const [w, hgt] = cutSize(pc);
      const f = FABRIC_NAME[pc.fabric] || '';
      return `<li><span class="mn">${esc(pc.name)}${pc.cut ? ` × ${pc.cut}枚` : ''}</span><span class="ms">${cm(w)}cm × ${cm(hgt)}cm</span>${f ? `<span class="cut-note">${f}から切ります</span>` : ''}</li>`;
    }).join('');
  }

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
      ? `${paper}の紙で <b>${n}</b> 枚 印刷して、貼り合わせます。${paper === 'A3' ? '<br><span class="muted small">A3 はプリンターが対応しているときだけ。</span>' : ''}`
      : `<span class="muted">紙の枚数は、ただいま準備中です。</span>`;
  };
  drawPapers();
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

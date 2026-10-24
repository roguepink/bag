// 作り方: 1手順ずつ大きく
import { esc, store, paramsOf, pickSize, SIZE_NAME, safe } from './ui-common.js';

const DONE_SVG = `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M34 34V26a14 14 0 0 1 28 0v8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 34h60l-5 46H23z" fill="currentColor" opacity=".12"/><path d="M18 34h60l-5 46H23z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M36 58l9 9 17-19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ことばの説明(js/glossary.js があるときだけ)
let glossP = null;
const loadGlossary = () => (glossP ||= import('./glossary.js').then((m) => (Array.isArray(m.GLOSSARY) ? m.GLOSSARY : []), () => []));

function withTerms(text, terms) {
  const t = esc(text);
  if (!terms.length) return t;
  // 文の中では find の形で探す(「わ」→「「わ」」など)。長い言葉から先に
  const key = (g) => esc(g.find || g.term);
  const re = new RegExp(terms.map((g) => key(g).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
  return t.replace(re, (m) => {
    const k = terms.findIndex((g) => key(g) === m);
    return `<button type="button" class="term" data-k="${k}">${m}</button>`;
  });
}

function openTerm(item) {
  document.querySelectorAll('.sheet-wrap').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet-back" data-close></div>
    <div class="gsheet" role="dialog" aria-modal="true" aria-label="${esc(item.term)}の説明">
      <p class="gsheet-term">${esc(item.term)}</p>
      <p class="gsheet-text">${esc(item.text)}</p>
      <button class="btn btn-primary btn-block" type="button" data-close>わかった</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => { el.remove(); window.removeEventListener('hashchange', close); };
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  window.addEventListener('hashchange', close);
  el.querySelector('button[data-close]').focus();
}

export async function renderSteps(root, { bag, go, isStale }) {
  const size = pickSize(bag, store.get('size'));
  const gloss = (await loadGlossary()).filter((g) => g && g.term && g.text)
    .sort((a, b) => (b.find || b.term).length - (a.find || a.term).length);
  if (isStale && isStale()) return;
  const steps = typeof bag.steps === 'function' ? (safe(() => bag.steps(paramsOf(bag, size)), []) || []) : [];
  const saved = store.get('step') || {};
  let i = Math.min(Math.max(0, saved[bag.id] || 0), steps.length); // steps.length = できあがり

  root.innerHTML = `
    <div class="page-head" style="margin-bottom:14px">
      <p class="kicker">作り方</p>
      <h1>${esc(bag.name)} <span class="size-tag">${SIZE_NAME[size]}</span></h1>
    </div>
    <div id="step-body"></div>
    ${steps.length ? `<details class="all-steps"><summary>手順をぜんぶ見る</summary>
      <ol>${steps.map((s) => `<li>${withTerms(s, gloss)}</li>`).join('')}</ol></details>` : ''}`;
  const body = root.querySelector('#step-body');

  if (!steps.length) {
    body.innerHTML = `<div class="empty"><p>作り方は、ただいま準備中です。</p></div>`;
    return;
  }

  const save = () => { const s = { ...(store.get('step') || {}) }; s[bag.id] = i; store.set('step', s); };
  const draw = () => {
    const bar = `<div class="step-progress" aria-hidden="true">${steps.map((_, k) => `<i class="${k <= i ? 'done' : ''}"></i>`).join('')}</div>`;
    if (i >= steps.length) {
      body.innerHTML = `${bar}<div class="step-card done-card">${DONE_SVG}
        <h2 style="margin-top:8px">できあがりです</h2>
        <p class="lead">おつかれさまでした。</p></div>
        <div class="step-nav">
          <button class="btn" type="button" data-prev><span class="arrow" aria-hidden="true">‹</span>まえ</button>
          <button class="btn btn-primary" type="button" data-home>ほかのバッグを見る</button>
        </div>
        <button class="btn btn-block" type="button" data-restart style="margin-top:14px;border-style:dashed">はじめの手順から</button>`;
    } else {
      body.innerHTML = `${bar}<div class="step-card" aria-live="polite">
          <div class="step-no"><span class="n">${i + 1}</span><span class="of">/ ${steps.length} 手順</span></div>
          <p class="step-text">${withTerms(steps[i], gloss)}</p></div>
        <div class="step-nav">
          <button class="btn" type="button" data-prev ${i === 0 ? 'disabled' : ''}><span class="arrow" aria-hidden="true">‹</span>まえ</button>
          <button class="btn btn-primary" type="button" data-next>${i === steps.length - 1 ? 'できた!' : 'つぎへ'}<span class="arrow" aria-hidden="true">›</span></button>
        </div>`;
    }
    const on = (sel, fn) => { const el = body.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('[data-prev]', () => { if (i > 0) { i--; save(); draw(); scrollUp(); } });
    on('[data-next]', () => { i++; save(); draw(); scrollUp(); });
    on('[data-restart]', () => { i = 0; save(); draw(); scrollUp(); });
    on('[data-home]', () => go(''));
  };
  const scrollUp = () => {
    const top = body.getBoundingClientRect().top + window.scrollY - 100;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  };
  const onTerm = (e) => {
    const b = e.target.closest('.term');
    if (!b) return;
    const item = gloss[+b.dataset.k];
    if (item) openTerm(item);
  };
  root.addEventListener('click', onTerm);
  draw();
  return () => {
    root.removeEventListener('click', onTerm);
    document.querySelectorAll('.sheet-wrap').forEach((el) => el.remove());
  };
}

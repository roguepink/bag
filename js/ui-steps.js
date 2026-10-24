// 作り方: 1手順ずつ大きく
import { esc, store, paramsOf, pickSize, SIZE_NAME, safe } from './ui-common.js';

const DONE_SVG = `<svg viewBox="0 0 96 96" aria-hidden="true"><path d="M34 34V26a14 14 0 0 1 28 0v8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 34h60l-5 46H23z" fill="currentColor" opacity=".12"/><path d="M18 34h60l-5 46H23z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M36 58l9 9 17-19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export async function renderSteps(root, { bag, go }) {
  const size = pickSize(bag, store.get('size'));
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
      <ol>${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}`;
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
          <p class="step-text">${esc(steps[i])}</p></div>
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
  draw();
}

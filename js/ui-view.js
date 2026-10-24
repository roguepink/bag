// 見る: 3D を大きく・大中小・柄と色
import {
  esc, h, store, loadViewer, loadFabric, paramsOf, pickSize, sizeKeysOf, SIZE_NAME, dimText, dimHTML,
  levelBadge, trendBadge, lookOf, bagIcon, FINGER_SVG, safe, defaultId, DEFAULT_FABRIC, DEFAULT_COLORWAY,
} from './ui-common.js';

export async function renderView(root, { bag, go, isStale }) {
  store.set('lastBag', bag.id);
  let size = pickSize(bag, store.get('size'));
  const fab = await loadFabric();
  if (isStale()) return;
  const FABRICS = (fab && fab.FABRICS) || [];
  const COLORWAYS = (fab && fab.COLORWAYS) || [];
  let fabric = FABRICS.find((f) => f.id === store.get('fabric')) ? store.get('fabric') : defaultId(FABRICS, DEFAULT_FABRIC);
  let colorway = COLORWAYS.find((c) => c.id === store.get('colorway')) ? store.get('colorway') : defaultId(COLORWAYS, DEFAULT_COLORWAY);

  root.innerHTML = `
    <div class="view-head">
      <h1>${esc(bag.name)}</h1>
      <span class="badges">${trendBadge(bag.trend)}${levelBadge(bag.level)}</span>
    </div>
    <div class="view-layout">
      <div class="stage-wrap">
        <div class="stage" id="stage" aria-label="バッグの立体の絵。指でなぞると回ります"></div>
      </div>
      <div class="controls">
        ${bag.desc ? `<p class="desc">${esc(bag.desc)}</p>` : ''}
        <section class="section" style="margin-top:22px">
          <p class="picker-label"><span>大きさ</span></p>
          <div class="size-buttons" id="sizes" role="group" aria-label="大きさ"></div>
          <div class="size-info" id="size-info" aria-live="polite"></div>
        </section>
        <section class="section" id="fabric-sec" style="margin-top:28px">
          <p class="picker-label"><span>布の柄</span><span class="now" id="fab-now"></span></p>
          <div class="swatches" id="fabrics" role="group" aria-label="布の柄"></div>
          <p class="scroll-hint" aria-hidden="true">‹ 横にずらすと、ほかの柄も ›</p>
          <p class="picker-label" style="margin-top:14px"><span>色</span><span class="now" id="cw-now"></span></p>
          <div class="swatches" id="colorways" role="group" aria-label="色"></div>
        </section>
      </div>
    </div>`;
  root.classList.add('has-dock');
  const dock = h(`<div class="dock"><div class="dock-inner">
    <button class="btn btn-primary btn-block" type="button" id="to-pattern">型紙を見る<span class="arrow" aria-hidden="true">›</span></button>
  </div></div>`);
  root.querySelector('.controls').appendChild(dock);
  dock.querySelector('#to-pattern').addEventListener('click', () => go(`b/${encodeURIComponent(bag.id)}/pattern`));

  // ---- 3D ----
  const stage = root.querySelector('#stage');
  let viewer = null;
  const mod = await loadViewer();
  if (isStale()) return;
  if (mod && typeof mod.createViewer === 'function') {
    try { viewer = mod.createViewer(stage); } catch (e) { console.warn('[ui] 3D を作れません', e); }
  }
  if (!viewer) {
    stage.innerHTML = `<div class="fallback"><div>${bagIcon(bag)}<p>立体の絵は、ただいま準備中です。</p></div></div>`;
  }
  const look = () => lookOf(fabric, colorway, COLORWAYS);
  const show = () => {
    if (!viewer) return;
    safe(() => viewer.show(bag.shape(paramsOf(bag, size)), look()));
  };
  show();
  if (viewer) safe(() => viewer.setAutoRotate && viewer.setAutoRotate(true));
  const onResize = () => viewer && safe(() => viewer.resize());
  window.addEventListener('resize', onResize);

  // 指で回せる案内(一度だけ)
  let hint = null;
  if (viewer && !store.get('hintShown')) {
    hint = h(`<div class="hint">${FINGER_SVG}<span>指でなぞると回ります</span></div>`);
    stage.appendChild(hint);
    const hide = () => {
      if (!hint) return;
      store.set('hintShown', true);
      const el = hint; hint = null;
      el.classList.add('out'); setTimeout(() => el.remove(), 400);
    };
    stage.addEventListener('pointerdown', hide, { once: true });
    setTimeout(hide, 7000);
  }
  stage.addEventListener('pointerdown', () => viewer && safe(() => viewer.setAutoRotate(false)));

  // ---- 大きさ ----
  const sizesEl = root.querySelector('#sizes');
  const info = root.querySelector('#size-info');
  const drawSizes = () => {
    sizesEl.innerHTML = '';
    for (const k of sizeKeysOf(bag)) {
      const b = h(`<button class="size-btn" type="button" aria-pressed="${k === size}">
        <span class="big">${SIZE_NAME[k]}</span><span class="sub">${k === 'S' ? 'ちいさめ' : k === 'L' ? 'おおきめ' : 'ふつう'}</span></button>`);
      b.addEventListener('click', () => { if (size === k) return; size = k; store.set('size', k); drawSizes(); show(); });
      sizesEl.appendChild(b);
    }
    const note = bag.sizeNote && bag.sizeNote[size];
    info.innerHTML = `<div class="dim">できあがり ${dimHTML(bag, size)}</div>${note ? `<div class="note">${esc(note)}</div>` : ''}`;
  };
  drawSizes();

  // ---- 柄と色 ----
  const sec = root.querySelector('#fabric-sec');
  if (!fab || (!FABRICS.length && !COLORWAYS.length)) {
    sec.innerHTML = `<p class="picker-label"><span>布の柄</span></p><div class="empty" style="padding:20px"><p class="muted" style="margin:0">柄は、ただいま準備中です。</p></div>`;
  } else {
    const fEl = root.querySelector('#fabrics');
    const cEl = root.querySelector('#colorways');
    const thumb = (f, c) => safe(() => fab.fabricThumb(f, c, 152), '');
    const cwBg = (cw) => {
      const cs = (cw && cw.colors) || ['#ddd'];
      const stops = cs.map((col, i) => `${col} ${(i / cs.length) * 100}% ${((i + 1) / cs.length) * 100}%`).join(',');
      return `conic-gradient(${stops})`;
    };
    const drawFabrics = () => {
      fEl.innerHTML = '';
      for (const f of FABRICS) {
        const url = thumb(f.id, colorway);
        const b = h(`<button class="swatch" type="button" aria-pressed="${f.id === fabric}">
          <span class="dot"></span><span class="nm">${esc(f.name)}</span></button>`);
        b.querySelector('.dot').style.backgroundImage = url ? `url("${url}")` : cwBg(COLORWAYS.find((c) => c.id === colorway));
        b.addEventListener('click', () => { fabric = f.id; store.set('fabric', f.id); drawFabrics(); drawColorways(); show(); });
        fEl.appendChild(b);
      }
      const cur = FABRICS.find((f) => f.id === fabric);
      root.querySelector('#fab-now').textContent = cur ? cur.name : '';
    };
    const drawColorways = () => {
      cEl.innerHTML = '';
      for (const c of COLORWAYS) {
        const url = thumb(fabric, c.id);
        const b = h(`<button class="swatch" type="button" aria-pressed="${c.id === colorway}">
          <span class="dot"></span><span class="nm">${esc(c.name)}</span></button>`);
        b.querySelector('.dot').style.backgroundImage = url ? `url("${url}")` : cwBg(c);
        b.addEventListener('click', () => { colorway = c.id; store.set('colorway', c.id); drawColorways(); drawFabrics(); show(); });
        cEl.appendChild(b);
      }
      const cur = COLORWAYS.find((c) => c.id === colorway);
      root.querySelector('#cw-now').textContent = cur ? cur.name : '';
    };
    if (FABRICS.length) drawFabrics(); else fEl.remove();
    if (COLORWAYS.length) drawColorways(); else cEl.remove();
    // えらんだものが見えるように
    requestAnimationFrame(() => {
      sec.querySelectorAll('.swatch[aria-pressed="true"]').forEach((el) => {
        const p = el.parentElement; p.scrollLeft = el.offsetLeft - p.clientWidth / 2 + el.clientWidth / 2;
      });
    });
  }

  return () => {
    window.removeEventListener('resize', onResize);
    if (viewer) safe(() => viewer.dispose());
    dock.remove();
  };
}

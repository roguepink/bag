// えらぶ: 仲間 → バッグ一覧
import {
  esc, h, store, groupIcon, bagIcon, levelBadge, trendBadge, currentLook,
  snapshotOf, cachedSnapshot, SIZE_NAME, pickSize,
} from './ui-common.js';

const preparing = `<div class="empty">
  <svg viewBox="0 0 96 96" aria-hidden="true"><path d="M34 34V26a14 14 0 0 1 28 0v8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 34h60l-5 46H23z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>
  <p><b>バッグを、ただいま準備しています。</b></p>
  <p class="muted">しばらくしてから、もう一度ひらいてください。</p></div>`;

export async function renderHome(root, { catalog, go }) {
  const { groups, bags } = catalog;
  root.innerHTML = `
    <section class="hero">
      <p class="kicker">手づくりの型紙</p>
      <h1>どんなバッグを<br>作りますか</h1>
      <p class="lead">形をえらぶと、原寸の型紙を家のプリンターで印刷できます。</p>
      <ol class="steps-mini" aria-label="すすめ方">
        <li><b>1</b>えらぶ</li><li><b>2</b>見る</li><li><b>3</b>型紙</li><li><b>4</b>印刷</li><li><b>5</b>作る</li>
      </ol>
    </section>
    <div id="resume-slot"></div>
    <h2 class="sr">バッグの仲間</h2>
    <div class="group-grid" id="groups"></div>`;

  const grid = root.querySelector('#groups');
  if (!groups.length) { grid.outerHTML = preparing; return; }
  for (const g of groups) {
    const n = bags.filter((b) => b.group === g.id).length;
    const card = h(`<button class="group-card" type="button">
      <span class="gicon">${groupIcon(g)}</span>
      <span class="gname">${esc(g.name)}</span>
      ${n ? `<span class="gcount">${n}しゅるい</span>` : ''}</button>`);
    card.addEventListener('click', () => go(`g/${encodeURIComponent(g.id)}`));
    grid.appendChild(card);
  }

  // つづきから
  const last = bags.find((b) => b.id === store.get('lastBag'));
  if (last) {
    const size = pickSize(last, store.get('size'));
    const btn = h(`<button class="resume" type="button">
      <span class="ph pic" style="width:76px;height:76px">${bagIcon(last)}</span>
      <span><span class="t1">前に見ていたバッグ</span><span class="t2">${esc(last.name)}(${SIZE_NAME[size]})</span></span>
      <span class="go" aria-hidden="true">›</span></button>`);
    btn.addEventListener('click', () => go(`b/${encodeURIComponent(last.id)}`));
    root.querySelector('#resume-slot').appendChild(btn);
    const look = await currentLook();
    const url = cachedSnapshot(last, look) || await snapshotOf(last, look, 200);
    if (url) btn.querySelector('.ph').innerHTML = `<img class="ready" src="${url}" alt="">`;
  }
}

export async function renderList(root, { route, catalog, go, isStale }) {
  const g = catalog.groups.find((x) => x.id === route.group) || { id: route.group, name: 'バッグ' };
  const bags = catalog.bags.filter((b) => b.group === g.id)
    .sort((a, b) => (b.trend ? 1 : 0) - (a.trend ? 1 : 0) || (a.level || 2) - (b.level || 2));
  root.innerHTML = `
    <div class="page-head">
      <p class="kicker">えらぶ</p>
      <h1>${esc(g.name)}</h1>
      <p class="lead">作りたい形を、ひとつえらんでください。</p>
    </div>
    <div class="bag-list" id="bags"></div>`;
  const list = root.querySelector('#bags');
  if (!bags.length) { list.outerHTML = preparing; return; }

  const look = await currentLook();
  const pics = [];
  for (const b of bags) {
    const shot = cachedSnapshot(b, look);
    const card = h(`<button class="bag-card" type="button">
      <span class="pic">${shot ? `<img src="${shot}" alt="">` : bagIcon(b)}</span>
      <span>
        <span class="bag-name">${esc(b.name)}</span>
        ${b.desc ? `<span class="bag-desc">${esc(b.desc)}</span>` : ''}
        <span class="badges">${trendBadge(b.trend)}${levelBadge(b.level)}</span>
      </span></button>`);
    card.addEventListener('click', () => go(`b/${encodeURIComponent(b.id)}`));
    list.appendChild(card);
    if (!shot) pics.push([b, card.querySelector('.pic')]);
  }
  // 3D の絵を1枚ずつ作って入れかえる
  for (const [b, pic] of pics) {
    if (isStale()) return;
    const url = await snapshotOf(b, look, 320);
    if (isStale()) return;
    if (url) pic.innerHTML = `<img class="ready" src="${url}" alt="">`;
  }
}

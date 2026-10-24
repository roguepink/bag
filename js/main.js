// 画面の切りかえ(#/ のあとで決める)
//   #/                 仲間をえらぶ
//   #/g/<group>        バッグ一覧
//   #/b/<bag>          見る(3D・大中小・柄)
//   #/b/<bag>/pattern  型紙
//   #/b/<bag>/print    印刷
//   #/b/<bag>/steps    作り方
import { getCatalog, store } from './ui-common.js';

const screen = document.getElementById('screen');
const backBtn = document.getElementById('back');
const shell = document.getElementById('app-shell');

let cleanup = null;
let renderNo = 0;
const visited = []; // このタブで通った道(もどるボタン用)

function parse() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'g' && parts[1]) return { name: 'list', group: parts[1] };
  if (parts[0] === 'b' && parts[1]) {
    const sub = parts[2] || 'view';
    return { name: ['pattern', 'print', 'steps'].includes(sub) ? sub : 'view', bag: parts[1] };
  }
  return { name: 'home' };
}

export function go(path, { replace = false } = {}) {
  const hash = '#/' + path.replace(/^\/+/, '');
  if (replace) location.replace(hash); else location.hash = hash;
}

function parentOf(route, catalog) {
  if (route.name === 'list') return '';
  if (route.name === 'view') {
    const bag = catalog.bags.find((b) => b.id === route.bag);
    return bag ? `g/${encodeURIComponent(bag.group)}` : '';
  }
  if (route.name === 'pattern') return `b/${encodeURIComponent(route.bag)}`;
  if (route.name === 'print') return `b/${encodeURIComponent(route.bag)}/pattern`;
  if (route.name === 'steps') return `b/${encodeURIComponent(route.bag)}/pattern`;
  return '';
}

let catalogP = null;
const catalog = () => (catalogP ||= getCatalog());

backBtn.addEventListener('click', async () => {
  const cat = await catalog();
  const parent = '#/' + parentOf(parse(), cat);
  const prev = visited[visited.length - 2];
  if (prev !== undefined && normalize(prev) === normalize(parent)) history.back();
  else go(parent.slice(2), { replace: true });
});
const normalize = (hsh) => (hsh || '#/').replace(/\/+$/, '') || '#';

async function render() {
  const my = ++renderNo;
  const route = parse();
  const cur = location.hash || '#/';
  if (visited[visited.length - 2] === cur) visited.pop(); else if (visited[visited.length - 1] !== cur) visited.push(cur);

  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  backBtn.hidden = route.name === 'home';
  shell.classList.toggle('is-home', route.name === 'home');
  screen.classList.remove('has-dock');
  document.querySelectorAll('.dock, .zoomer').forEach((el) => el.remove());

  const cat = await catalog();
  if (my !== renderNo) return;

  const ctx = { route, catalog: cat, go, store, isStale: () => my !== renderNo };
  const bag = route.bag ? cat.bags.find((b) => b.id === route.bag) : null;
  if (route.bag && !bag) {
    screen.innerHTML = notFound(cat);
    return;
  }
  ctx.bag = bag;

  const mods = {
    home: () => import('./ui-choose.js').then((m) => m.renderHome),
    list: () => import('./ui-choose.js').then((m) => m.renderList),
    view: () => import('./ui-view.js').then((m) => m.renderView),
    pattern: () => import('./ui-pattern.js').then((m) => m.renderPattern),
    print: () => import('./ui-print.js').then((m) => m.renderPrint),
    steps: () => import('./ui-steps.js').then((m) => m.renderSteps),
  };
  try {
    const fn = await mods[route.name]();
    if (my !== renderNo) return;
    screen.innerHTML = '';
    screen.classList.remove('fade-in'); void screen.offsetWidth; screen.classList.add('fade-in');
    window.scrollTo(0, 0);
    const c = await fn(screen, ctx);
    if (my !== renderNo) { if (typeof c === 'function') c(); return; }
    cleanup = typeof c === 'function' ? c : null;
    const h1 = screen.querySelector('h1');
    document.title = h1 ? `${h1.textContent} | バッグの型紙` : 'バッグの型紙';
  } catch (e) {
    console.error(e);
    screen.innerHTML = `<div class="empty"><p>うまく表示できませんでした。</p><p class="muted">「もどる」を押すか、もう一度ひらいてください。</p></div>`;
  }
}

function notFound() {
  return `<div class="page-head"><h1>見つかりませんでした</h1>
    <p class="lead">このバッグは、いまは入っていません。</p></div>
    <a class="btn btn-primary btn-block" href="#/">はじめの画面へ</a>`;
}

window.addEventListener('hashchange', render);
render();

// オフラインで使えるように
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw]', e));
  });
}


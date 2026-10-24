// 3D係: バッグを 3D で見せる。
// createViewer(containerEl) => { show(shape, look), setAutoRotate(bool), resize(), snapshot(px), dispose() }
// show は Promise を返す(柄の絵ができて、形がそろったら終わる)。
// 回し方: 1本指/マウスでドラッグ = 回る、2本指ピンチ/ホイール = 寄る・引く、ダブルタップ = もとの向き。
import * as THREE from 'three';
import { buildBag } from './viewer3d-bag.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- 柄(fabric.js)
let fabricMod = null;
const fabricReady = import('./fabric.js').then(m => { fabricMod = m; }).catch(() => { fabricMod = null; });

const FALLBACK = {   // fabric.js がまだ無いときの色
  navy: '#2f3d5c', kon: '#2f3d5c', red: '#a63a3f', aka: '#a63a3f', green: '#4f6b4a', midori: '#4f6b4a',
  mustard: '#c99a2e', yellow: '#d7b443', pink: '#d99aa5', beige: '#d8c8ad', kinari: '#e9e0cc', white: '#f2efe8',
  black: '#2a2a2a', gray: '#8a8a88', grey: '#8a8a88', brown: '#7a5638', blue: '#4b6fa0', purple: '#6f5a8c', orange: '#d0773a',
};
function colorOf(v, fallback) {
  if (!v) return fallback;
  if (typeof v === 'string' && (v[0] === '#' || v.startsWith('rgb'))) return v;
  if (fabricMod && Array.isArray(fabricMod.COLORWAYS)) {
    const cw = fabricMod.COLORWAYS.find(c => c.id === v);
    if (cw && cw.colors && cw.colors.length) return cw.colors[0];
  }
  return FALLBACK[v] || fallback;
}
function avgColor(canvas) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; return new THREE.Color(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
  } catch (e) { return null; }
}
async function fabricLook(look) {
  await fabricReady;
  const fabricId = look.fabric || 'plain', cwId = look.colorway || 'navy';
  let canvas = null, tileMm = 100;
  if (fabricMod && typeof fabricMod.fabricCanvas === 'function') {
    try {
      canvas = fabricMod.fabricCanvas(fabricId, cwId, 512);
      const f = (fabricMod.FABRICS || []).find(x => x.id === fabricId);
      if (f && +f.tileCm > 0) tileMm = +f.tileCm * 10;
    } catch (e) { canvas = null; }
  }
  const base = colorOf(cwId, '#7d8fa6');
  let tex = null, avg = new THREE.Color(base);
  if (canvas) {
    tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / tileMm, 1 / tileMm);
    tex.anisotropy = 4;
    avg = avgColor(canvas) || avg;
  }
  return { tex, avg, base };
}

// ---------------------------------------------------------------- 材料
function makeMaterials(fl, look, maxAniso) {
  const SRGB = c => new THREE.Color(c);
  if (fl.tex) fl.tex.anisotropy = Math.min(4, maxAniso || 1);
  const fabColor = fl.tex ? 0xffffff : SRGB(fl.base);
  const fab = (side, vc = true) => new THREE.MeshStandardMaterial({ color: fabColor, map: fl.tex, roughness: 0.92, metalness: 0, side, vertexColors: vc });
  const liningC = SRGB(colorOf(look.lining, '#e8dfcf'));
  const strapC = look.strapColor ? SRGB(colorOf(look.strapColor, '#6b4f3a')) : null;
  const lum = fl.avg.r * 0.3 + fl.avg.g * 0.59 + fl.avg.b * 0.11;
  const thread = lum > 0.55 ? fl.avg.clone().multiplyScalar(0.62) : fl.avg.clone().lerp(new THREE.Color('#ffffff'), 0.55);
  const strapLum = strapC ? strapC.r * 0.3 + strapC.g * 0.59 + strapC.b * 0.11 : lum;
  const strapThread = strapC ? (strapLum > 0.55 ? strapC.clone().multiplyScalar(0.6) : strapC.clone().lerp(new THREE.Color('#ffffff'), 0.5)) : thread;
  const M = {
    outer: fab(THREE.FrontSide),
    outerD: fab(THREE.DoubleSide, false),
    flapOuter: fab(THREE.FrontSide),
    lining: new THREE.MeshStandardMaterial({ color: liningC, roughness: 0.95, side: THREE.BackSide, vertexColors: true }),
    liningCap: new THREE.MeshStandardMaterial({ color: liningC, roughness: 0.95, side: THREE.BackSide, vertexColors: true }),
    flapLining: new THREE.MeshStandardMaterial({ color: liningC, roughness: 0.95, side: THREE.BackSide }),
    rim: new THREE.MeshStandardMaterial({ color: fl.avg.clone().multiplyScalar(0.95), roughness: 0.9 }),
    rimDark: new THREE.MeshStandardMaterial({ color: fl.avg.clone().multiplyScalar(0.7), roughness: 0.9 }),
    strap: strapC ? new THREE.MeshStandardMaterial({ color: strapC, roughness: 0.8, side: THREE.DoubleSide }) : fab(THREE.DoubleSide, false),
    cordStrap: new THREE.MeshStandardMaterial({ color: strapC || fl.avg, roughness: 0.85 }),
    leather: new THREE.MeshStandardMaterial({ color: strapC || new THREE.Color('#7a5638'), roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: new THREE.Color('#b9895a'), roughness: 0.55 }),
    cord: new THREE.MeshStandardMaterial({ color: strapC || liningC, roughness: 0.85 }),
    bead: new THREE.MeshStandardMaterial({ color: new THREE.Color('#8b6a48'), roughness: 0.55 }),
    zipTape: new THREE.MeshStandardMaterial({ color: new THREE.Color('#2e2d2b'), roughness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#cdb27a'), roughness: 0.32, metalness: 0.55 }),
    stitch: new THREE.LineDashedMaterial({ color: thread, dashSize: 4, gapSize: 2.6, transparent: true, opacity: 0.9 }),
    strapStitch: new THREE.LineDashedMaterial({ color: strapThread, dashSize: 4, gapSize: 2.6, transparent: true, opacity: 0.9 }),
    seam: new THREE.LineBasicMaterial({ color: fl.avg.clone().multiplyScalar(0.55), transparent: true, opacity: 0.45 }),
  };
  M.liningD = M.outerD;
  return M;
}

// 床の丸い影
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.45, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
  });
}

// ---------------------------------------------------------------- 見る係
export function createViewer(containerEl) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none', outline: 'none' });
  canvas.setAttribute('aria-label', 'バッグの立体の絵。指でなぞると回ります');
  canvas.setAttribute('role', 'img');
  if (getComputedStyle(containerEl).position === 'static') containerEl.style.position = 'relative';
  containerEl.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 50000);
  scene.add(new THREE.HemisphereLight(0xfffaf2, 0xb9b2a6, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-1.2, 2.2, 1.8); scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.55); fill.position.set(1.8, 0.8, 0.6); scene.add(fill);
  const back = new THREE.DirectionalLight(0xffffff, 0.45); back.position.set(0.3, 1.2, -2); scene.add(back);
  // ライトはカメラといっしょに回す(どこから見ても明るい)
  const lightRig = new THREE.Group(); lightRig.add(key, fill, back); scene.add(lightRig);

  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.55 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.x = -PI / 2; shadow.renderOrder = -1; scene.add(shadow);

  let bag = null, mats = null, tex = null, token = 0, shownOnce = false;
  const target = new THREE.Vector3(0, 150, 0);
  let fitDist = 1200;
  // 向き: theta(横)・phi(上下)・dist(距離)。今の値は目標に、ゆっくり近づく
  const cur = { theta: -0.55, phi: 0.3, zoom: 1 }, goal = { ...cur };
  const DEF = { theta: -0.55, phi: 0.3, zoom: 1 };
  let autoRotate = true, lastTouch = -1e9, dirty = true;
  const IDLE_MS = 3500, AUTO_SPEED = 0.16;   // 1周 約40秒
  const PHI_MIN = -0.08, PHI_MAX = 0.95, ZMIN = 0.5, ZMAX = 1.9;

  function placeCamera(c = cur, distBase = fitDist) {
    const d = distBase * c.zoom;
    camera.position.set(
      target.x + d * Math.cos(c.phi) * Math.sin(c.theta),
      target.y + d * Math.sin(c.phi),
      target.z + d * Math.cos(c.phi) * Math.cos(c.theta));
    camera.lookAt(target);
    lightRig.rotation.y = c.theta;
  }

  // ---- 大きさ
  let W = 1, H = 1;
  function resize() {
    const r = containerEl.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    fit(); dirty = true;
  }
  let sphereR = 300;
  function fit() {
    const vf = camera.fov * PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const f = Math.min(vf, hf);
    fitDist = sphereR / Math.sin(f / 2) * 1.02;
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(containerEl); else window.addEventListener('resize', resize);

  // ---- さわる
  const pts = new Map();
  let pinch0 = 0, zoom0 = 1, lastTap = 0;
  const touched = () => { lastTouch = performance.now(); kick(); };
  function onDown(e) {
    canvas.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; zoom0 = goal.zoom; }
    if (pts.size === 1) {
      const now = performance.now();
      if (now - lastTap < 320) { Object.assign(goal, DEF, { theta: cur.theta - ((cur.theta - DEF.theta) % (2 * PI)) }); }
      lastTap = now;
    }
    touched();
  }
  function onMove(e) {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      const k = 3.2 / Math.max(240, Math.min(W, H) * 1.6);   // 画面の大きさに合わせて、ゆっくり
      goal.theta -= dx * k;
      goal.phi = clamp(goal.phi + dy * k * 0.8, PHI_MIN, PHI_MAX);
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      goal.zoom = clamp(zoom0 * pinch0 / dd, ZMIN, ZMAX);
    }
    touched();
  }
  function onUp(e) { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; touched(); }
  function onWheel(e) {
    e.preventDefault();
    goal.zoom = clamp(goal.zoom * Math.exp(clamp(e.deltaY, -120, 120) * 0.0012), ZMIN, ZMAX); touched();
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // ---- 動かす
  let raf = 0, last = performance.now(), visible = true, alive = true;
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(es => { visible = es.some(x => x.isIntersecting); if (visible) kick(); }) : null;
  if (io) io.observe(containerEl);
  const onVis = () => { if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);

  function frame(now) {
    raf = 0; if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const idle = now - lastTouch > IDLE_MS && pts.size === 0;
    if (autoRotate && idle && bag) { goal.theta += AUTO_SPEED * dt; dirty = true; }
    const k = 1 - Math.pow(0.004, dt);       // なめらかに追いかける
    let moving = false;
    for (const key of ['theta', 'phi', 'zoom']) {
      const diff = goal[key] - cur[key];
      if (Math.abs(diff) > 1e-4) { cur[key] += diff * k; moving = true; } else cur[key] = goal[key];
    }
    if (moving || dirty) { placeCamera(); renderer.render(scene, camera); dirty = false; }
    if (visible && !document.hidden && (moving || (autoRotate && bag) || pts.size)) raf = requestAnimationFrame(frame);
  }
  function kick() { dirty = true; if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  // ---- 見せる
  async function show(shape, look = {}) {
    const my = ++token;
    const fl = await fabricLook(look || {});
    if (my !== token || !alive) { fl.tex && fl.tex.dispose(); return; }
    const newMats = makeMaterials(fl, look || {}, renderer.capabilities.getMaxAnisotropy());
    let built;
    try { built = buildBag(shape || {}, newMats); }
    catch (e) { console.error('[viewer3d] 形を作れませんでした', e); built = buildBag({ family: 'boxed', w: 300, h: 300, d: 100 }, newMats); }
    clearBag();
    bag = built.group; mats = newMats; tex = fl.tex;
    viewTheta = built.cfg.viewTheta ?? DEF.theta;
    if (Math.abs(goal.theta - cur.theta) < 1e-3 && performance.now() - lastTouch > IDLE_MS && !shownOnce) { cur.theta = goal.theta = viewTheta; }
    shownOnce = true;
    scene.add(bag);
    // まん中と大きさ
    const box = new THREE.Box3().setFromObject(bag), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    target.copy(c); target.y = c.y * 0.98;
    sphereR = Math.max(sz.length() / 2, 60);
    camera.near = sphereR * 0.05; camera.far = sphereR * 40; camera.updateProjectionMatrix();
    const fw = Math.max(built.cfg.w, 60), fd = Math.max(built.cfg.d || built.cfg.w * 0.3, 40);
    shadow.scale.set(fw * 1.55, fd * 1.9 + fw * 0.25, 1); shadow.position.set(0, -0.5, 0);
    fit(); dirty = true; kick();
    return true;
  }
  function clearBag() {
    if (bag) { scene.remove(bag); disposeTree(bag); bag = null; }
    if (mats) { for (const m of Object.values(mats)) m.dispose?.(); mats = null; }
    if (tex) { tex.dispose(); tex = null; }
  }

  function setAutoRotate(on) { autoRotate = !!on; if (on) lastTouch = -1e9; kick(); }

  // 一覧用の絵(決まった向きで撮る)。PNG の dataURL
  let viewTheta = DEF.theta;
  function snapshot(px = 512, opt = {}) {
    px = clamp(Math.round(px) || 512, 32, 2048);
    const pr = renderer.getPixelRatio(), oldAspect = camera.aspect;
    renderer.setPixelRatio(1); renderer.setSize(px, px, false);
    camera.aspect = 1; camera.updateProjectionMatrix();
    const vf = camera.fov * PI / 180; const d = sphereR / Math.sin(vf / 2) * 0.98;
    placeCamera({ theta: opt.theta ?? viewTheta, phi: opt.phi ?? 0.28, zoom: 1 }, d);
    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    camera.aspect = oldAspect; camera.updateProjectionMatrix();
    placeCamera(); dirty = true; renderer.render(scene, camera);
    return url;
  }

  function dispose() {
    alive = false; if (raf) cancelAnimationFrame(raf);
    ro && ro.disconnect(); io && io.disconnect();
    if (!ro) window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    clearBag();
    shadow.geometry.dispose(); shadowMat.map.dispose(); shadowMat.dispose();
    renderer.dispose(); renderer.forceContextLoss?.();
    canvas.remove();
  }

  resize(); placeCamera(); kick();
  return { show, setAutoRotate, resize, snapshot, dispose };
}

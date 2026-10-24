#!/usr/bin/env python3
"""バッグの型紙アプリ 総合チェック(総合チェック係)

使い方:
  source ~/.local/venvs/ryokoshi/bin/activate
  python3 tools/check.py                 # ぜんぶ(30袋 × S/M/L、画面、印刷PDF)
  python3 tools/check.py --quick         # 速く(A4 だけ・1ページ目だけ調べる・画面はグループの先頭の袋だけ)
  python3 tools/check.py --bag tote-basic --size M   # 1袋だけ
  python3 tools/check.py --only data     # data / ui / pdf / offline のどれかだけ(カンマで複数)
  python3 tools/check.py --pdf-bag gama-... --pdf-size L   # PDF を作る袋

結果: _check/report.md(表)、_check/report.json、_check/*.png(スクリーンショット)、_check/*.pdf
しくみ: 自分で python の http.server を空いている番号で立てて、終わったら止める。
        Chrome(channel='chrome')を headless・--mute-audio で動かす。Mac の画面はつけない。
"""
import argparse
import functools
import http.server
import json
import os
import re
import socket
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '_check'
BUSY_PORTS = {8765, 8781, 8791, 8792, 8793, 8794}
PHONE = {'width': 390, 'height': 844}


# ---------------------------------------------------------------- サーバー
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def free_port():
    for port in range(8800, 8900):
        if port in BUSY_PORTS:
            continue
        with socket.socket() as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise RuntimeError('空いている番号がない')


def start_server():
    port = free_port()
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    return srv, f'http://127.0.0.1:{port}/'


# ---------------------------------------------------------------- 画面を測る JS
MEASURE_JS = r"""
() => {
  const vw = window.innerWidth;
  const res = { overflowX: document.documentElement.scrollWidth - vw, smallText: [], smallBtn: [], outside: [] };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    if (el.closest('[hidden], .sr, .offstage, #print-area, [aria-hidden="true"]')) return false;
    return true;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const s = t.textContent.trim();
    if (!s) continue;
    const el = t.parentElement;
    if (!el || el.closest('svg') || el.closest('script,style,noscript')) continue;
    if (seen.has(el) || !visible(el)) continue;
    seen.add(el);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 20) res.smallText.push({ fs, text: s.slice(0, 24), cls: el.className && String(el.className).slice(0, 30), tag: el.tagName });
  }
  for (const el of document.querySelectorAll('button, a[href], [role=button], summary, .btn')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 64) res.smallBtn.push({ h: Math.round(r.height), w: Math.round(r.width), text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24), cls: String(el.className).slice(0, 30) });
  }
  // 右にはみ出している要素(横スクロールの原因)
  if (res.overflowX > 0) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && !el.closest('.swatches, .page-map-wrap, .zoomer-body, .offstage, #print-area')) {
        res.outside.push({ tag: el.tagName, cls: String(el.className).slice(0, 30), right: Math.round(r.right) });
        if (res.outside.length > 5) break;
      }
    }
  }
  // 全体図(SVG)の文字が 画面で何 px になっているか
  const ov = [];
  for (const t of document.querySelectorAll('#screen .svgbox svg text')) {
    const m = t.getScreenCTM(); if (!m) continue;
    const fs = parseFloat(t.getAttribute('font-size')) * Math.hypot(m.a, m.b);
    if (fs > 0) ov.push(fs);
  }
  ov.sort((a, b) => a - b);
  res.ovText = ov.length ? { n: ov.length, min: +ov[0].toFixed(1), median: +ov[Math.floor(ov.length / 2)].toFixed(1), under12: ov.filter((v) => v < 12).length } : null;
  res.h1 = (document.querySelector('#screen h1') || {}).textContent || '';
  res.broken = !!document.querySelector('#screen .empty, #screen .notice, #screen .fallback');
  res.brokenText = res.broken ? (document.querySelector('#screen .empty, #screen .notice, #screen .fallback').textContent || '').trim().slice(0, 60) : '';
  return res;
}
"""


def summarize_small(items, key):
    """同じ種類を まとめて数える"""
    agg = {}
    for it in items:
        k = (it.get('cls') or it.get('tag') or '?', it.get(key))
        a = agg.setdefault(k, {'n': 0, 'ex': it.get('text', '')})
        a['n'] += 1
    return agg


# ---------------------------------------------------------------- 1. 型紙のデータ
def run_data(page, base, bags, sizes, quick):
    js = (ROOT / 'tools' / 'check_data.js').read_text(encoding='utf-8')
    js = '\n'.join(l for l in js.splitlines() if not l.lstrip().startswith('//'))
    page.goto(base + 'tools/', wait_until='domcontentloaded') if (ROOT / 'tools' / 'index.html').exists() else page.goto(base + 'index.html#/__check', wait_until='load')
    t0 = time.time()
    res = page.evaluate(js, {'bags': bags, 'sizes': sizes, 'quick': quick})
    res['seconds'] = round(time.time() - t0, 1)
    return res


# ---------------------------------------------------------------- 2. 画面の流れ
class Console:
    def __init__(self, page):
        self.items = []
        page.on('console', lambda m: self.items.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: self.items.append(('pageerror', str(e))))
        page.on('requestfailed', lambda r: self.items.append(('requestfailed', r.url)))
        page.on('response', lambda r: self.items.append(('http' + str(r.status), r.url)) if r.status >= 400 else None)

    def take(self):
        out, self.items = self.items, []
        return out


def wait_screen(page, timeout=15000):
    page.wait_for_function("() => { const s = document.querySelector('#screen'); return s && !s.querySelector('.loading') && s.children.length > 0; }", timeout=timeout)
    page.wait_for_timeout(250)


def stage_drawn(page):
    """3D の canvas に何か描けているか(スクリーンショットの色のばらつきで見る)"""
    try:
        page.wait_for_selector('#stage canvas', timeout=10000)
    except Exception:
        return {'canvas': False, 'drawn': False}
    page.wait_for_timeout(1200)
    try:
        from PIL import Image, ImageStat
        import io
        png = page.locator('#stage').screenshot()
        im = Image.open(io.BytesIO(png)).convert('L')
        st = ImageStat.Stat(im)
        return {'canvas': True, 'drawn': st.stddev[0] > 6, 'std': round(st.stddev[0], 1)}
    except Exception as e:
        return {'canvas': True, 'drawn': None, 'err': str(e)}


PROBE_JS = r"""
(kind) => {
  const q = (s) => document.querySelector(s);
  const cs = (el) => el ? getComputedStyle(el) : null;
  const out = {};
  if (kind === 'home') {
    const b = q('.steps-mini b');
    out.stepsMiniBg = b ? cs(b).backgroundColor : null;
    out.groupNames = [...document.querySelectorAll('.group-card .gname')].map((e) => ({ t: e.textContent.trim(), lines: Math.round(e.getBoundingClientRect().height / parseFloat(cs(e).lineHeight || 30)) }));
  }
  if (kind === 'list') {
    const d = [...document.querySelectorAll('.bag-desc')];
    out.descClamped = d.filter((e) => e.scrollHeight > e.clientHeight + 2).length;
    const tb = q('.badge.trend');
    out.trendBg = tb ? cs(tb).backgroundColor : null;
  }
  if (kind === 'view') {
    const st = q('#stage'), cv = q('#stage canvas');
    out.touch = [st && cs(st).touchAction, cv && cs(cv).touchAction];
    out.stageH = st ? Math.round(st.getBoundingClientRect().height) : 0;
    // ちぎれた柄の名前(1語が2行に分かれているか)
    out.swatchNames = [...document.querySelectorAll('.swatch .nm')].map((e) => ({ t: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height), lh: parseFloat(cs(e).lineHeight) || 0, sw: e.scrollWidth > e.clientWidth + 1 }));
    out.fabricNames = [...document.querySelectorAll('#fabrics .swatch .nm')].map((e) => e.textContent.trim());
    const dock = q('.dock'), sizes = q('#sizes');
    out.dock = dock ? cs(dock).position : null;
  }
  if (kind === 'pattern') {
    out.text = (q('#screen') || {}).innerText || '';
    out.hasList = !!q('#screen .part-list, #screen .parts, #screen ol, #screen .pieces');
  }
  if (kind === 'print') {
    out.routes = [...document.querySelectorAll('.route-btn')].map((e) => e.textContent.trim());
    out.h1 = (q('#screen h1') || {}).textContent || '';
    out.printOne = !!q('#print-one'); out.paperChips = document.querySelectorAll('[data-paper]').length;
    out.text = (q('#screen') || {}).innerText || '';
  }
  if (kind === 'steps') {
    out.terms = [...document.querySelectorAll('#screen .all-steps .term')].map((e) => e.textContent);
    out.figs = document.querySelectorAll('#screen .step-card svg, #screen .step-card img').length;
  }
  return out;
}
"""


def click_or_hash(page, sel, bid, sub):
    btn = page.locator(sel)
    if btn.count() and btn.first.is_visible():
        btn.first.click()
    else:
        page.evaluate("([id, s]) => location.hash = '#/b/' + id + s", [bid, sub])
    wait_screen(page)


def run_ui(browser, base, bag_ids, size, quick, shots):
    ctx = browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True,
                              service_workers='block', locale='ja-JP')
    page = ctx.new_page()
    con = Console(page)
    screens = []
    feats = {}   # 新しい所の動き

    def snap(name):
        path = OUT / f'{name}.png'
        page.screenshot(path=str(path), full_page=False)
        return str(path.relative_to(ROOT))

    def record(kind, label, bag=None, shot_name=None, extra=None):
        m = page.evaluate(MEASURE_JS)
        pr = page.evaluate(PROBE_JS, kind)
        errs = [c for c in con.take() if c[0] in ('error', 'pageerror', 'requestfailed') or c[0].startswith('http')]
        rec = {'kind': kind, 'label': label, 'bag': bag, 'hash': page.evaluate('location.hash'),
               'overflowX': m['overflowX'], 'outside': m['outside'], 'smallText': m['smallText'], 'smallBtn': m['smallBtn'],
               'errors': errs, 'ovText': m.get('ovText'), 'h1': m['h1'].strip(), 'broken': m['broken'], 'brokenText': m['brokenText'], 'probe': pr}
        if extra:
            rec.update(extra)
        problem = errs or m['overflowX'] > 0 or (extra and extra.get('stage', {}).get('drawn') is False)
        name = None
        if shot_name and (shot_name not in shots['done']):
            name = shot_name
        elif problem and shots['problems'] < shots['max_problems']:
            name = f"problem-{shots['problems']:02d}-{kind}-{bag or label}"
            shots['problems'] += 1
        if name:
            path = OUT / f'{name}.png'
            page.screenshot(path=str(path), full_page=True)
            rec['shot'] = str(path.relative_to(ROOT))
            shots['done'].add(shot_name or name)
        screens.append(rec)
        return rec

    page.goto(base + 'index.html', wait_until='load')
    page.evaluate("(s) => localStorage.setItem('bag-katagami.v1', JSON.stringify({size: s, paper: 'A4', hintShown: false}))", size)
    page.goto(base + 'index.html#/', wait_until='load')
    wait_screen(page)
    page.wait_for_timeout(600)
    record('home', 'はじめ', shot_name='screen-1-home')
    groups = page.evaluate("async () => { const m = await import('./js/bags/index.js'); return m.GROUPS.map(g => ({id: g.id, name: g.name, bags: m.BAGS.filter(b => b.group === g.id).map(b => b.id)})); }")

    for gi, g in enumerate(groups):
        targets = [b for b in g['bags'] if (not bag_ids or b in bag_ids)]
        if bag_ids and not targets:
            continue
        page.goto(base + 'index.html#/', wait_until='load')
        wait_screen(page)
        cards = page.locator('.group-card')
        if cards.count() > gi:
            cards.nth(gi).click()
        else:
            page.evaluate("(id) => location.hash = '#/g/' + id", g['id'])
        wait_screen(page)
        page.wait_for_timeout(500)
        record('list', g['name'], shot_name=f"screen-2-list-{g['id']}" if gi == 0 or not quick else None)
        if quick and not bag_ids:
            targets = targets[:1]
        for bi, bid in enumerate(targets):
            page.evaluate("(id) => location.hash = '#/b/' + id", bid)
            wait_screen(page)
            st = stage_drawn(page)
            first = (gi == 0 and bi == 0)
            record('view', bid, bag=bid, shot_name='screen-3-view' if first else None, extra={'stage': st})
            if first:
                # 柄を選ぶ → 小さな見本(mini-view)
                page.evaluate("() => document.querySelector('#fabrics').scrollIntoView({block: 'center'})")
                page.wait_for_timeout(500)
                sw = page.locator('#fabrics .swatch')
                if sw.count() > 2:
                    sw.nth(2).click()
                    page.wait_for_timeout(1800)
                    mv = page.evaluate("() => { const m = document.querySelector('.mini-view'); if (!m) return null; const r = m.getBoundingClientRect(); const img = m.querySelector('img'); return { hidden: m.hidden, visible: r.width > 0 && r.bottom > 0 && r.top < innerHeight, src: img && img.src.startsWith('data:image') && img.src.length > 2000, w: Math.round(r.width), h: Math.round(r.height) }; }")
                    feats['miniView'] = mv
                    feats['miniViewShot'] = snap('new-1-fabric-mini-view')
                    # もとの柄にもどす
                    sw.nth(0).click()
                    page.wait_for_timeout(300)
                con.take()
            click_or_hash(page, '#to-pattern', bid, '/pattern')
            record('pattern', bid, bag=bid, shot_name='screen-4-pattern' if first else None)
            click_or_hash(page, '#to-print', bid, '/print')
            record('print', bid, bag=bid, shot_name='screen-5-print' if first else ('screen-5-print-azuma' if bid == 'wa-azuma' else None))
            if first:
                # 印刷の3つの道 と Android/iPhone
                routes = {}
                for i, rid in enumerate(['pc', 'phone', 'store']):
                    b = page.locator(f'[data-route="{rid}"]')
                    if not b.count():
                        routes[rid] = None
                        continue
                    b.click()
                    page.wait_for_timeout(250)
                    card = page.evaluate("() => { const c = document.querySelector('.guide .guide-card'); return c ? c.innerText.slice(0, 200) : ''; }")
                    pressed = page.evaluate(f"() => document.querySelector('[data-route=\"{rid}\"]').getAttribute('aria-pressed')")
                    routes[rid] = {'pressed': pressed, 'text': card}
                    if rid == 'phone':
                        for os_ in ['android', 'iphone']:
                            ob = page.locator(f'[data-os="{os_}"]')
                            if ob.count():
                                ob.click()
                                page.wait_for_timeout(250)
                                routes[f'phone-{os_}'] = {'pressed': page.evaluate(f"() => document.querySelector('[data-os=\"{os_}\"]').getAttribute('aria-pressed')"),
                                                          'text': page.evaluate("() => document.querySelector('.guide .guide-card').innerText.slice(0, 260)")}
                        page.evaluate("() => document.querySelector('.os-tabs') && document.querySelector('.os-tabs').scrollIntoView({block: 'start'})")
                        page.wait_for_timeout(300)
                        routes['shot'] = snap('new-2-print-phone-iphone')
                feats['routes'] = routes
                page.locator('[data-route="pc"]').click() if page.locator('[data-route="pc"]').count() else None
                con.take()
            click_or_hash(page, '#to-steps', bid, '/steps')
            rec = record('steps', bid, bag=bid, shot_name='screen-6-steps' if first else None)
            if first or bid in ('bp-knapsack', 'po-gama'):
                # ことばの説明の板
                res = {'bag': bid}
                page.evaluate("() => { const d = document.querySelector('.all-steps'); if (d) d.open = true; }")
                page.wait_for_timeout(200)
                terms = page.locator('#screen .term')
                res['count'] = terms.count()
                want = None
                for t in ['返し口', '「わ」', 'わ', 'あき止まり', '仮どめ']:
                    loc = page.locator('#screen .term', has_text=t)
                    if loc.count():
                        want = loc.first
                        res['term'] = t
                        break
                if want is None and terms.count():
                    want = terms.first
                    res['term'] = want.text_content()
                if want is not None:
                    want.scroll_into_view_if_needed()
                    want.click()
                    page.wait_for_timeout(300)
                    res['open'] = page.evaluate("() => { const s = document.querySelector('.gsheet'); if (!s) return null; const r = s.getBoundingClientRect(); return { title: s.querySelector('.gsheet-term').textContent, text: s.querySelector('.gsheet-text').textContent.slice(0, 60), inView: r.top >= 0 && r.bottom <= innerHeight + 1, fs: parseFloat(getComputedStyle(s.querySelector('.gsheet-text')).fontSize) }; }")
                    if first:
                        res['shot'] = snap('new-3-term-sheet')
                    # 「わかった」で閉じる
                    page.locator('.gsheet button[data-close]').click()
                    page.wait_for_timeout(200)
                    res['closedByBtn'] = page.locator('.sheet-wrap').count() == 0
                    # うしろを押して閉じる
                    want.click()
                    page.wait_for_timeout(200)
                    page.mouse.click(195, 40)
                    page.wait_for_timeout(200)
                    res['closedByBack'] = page.locator('.sheet-wrap').count() == 0
                    # 開いたまま もどる
                    want.click()
                    page.wait_for_timeout(200)
                    page.evaluate("() => history.back()")
                    wait_screen(page)
                    res['closedByNav'] = page.locator('.sheet-wrap').count() == 0
                    page.evaluate("(id) => location.hash = '#/b/' + id + '/steps'", bid)
                    wait_screen(page)
                feats.setdefault('terms', []).append(res)
                con.take()
            page.locator('#back').click()
            wait_screen(page)
            rec['backTo'] = page.evaluate('location.hash')
    # 型紙の「大きく見る」と ＋−
    if screens:
        b0 = bag_ids[0] if bag_ids else groups[0]['bags'][0]
        page.evaluate("(id) => location.hash = '#/b/' + id + '/pattern'", b0)
        wait_screen(page)
        if page.locator('#ov').count():
            page.locator('#ov').click()
            page.wait_for_timeout(400)
            w = lambda: page.evaluate("() => { const s = document.querySelector('.zoomer svg'); return s ? Math.round(s.getBoundingClientRect().width) : 0; }")
            z = {'w0': w()}
            for i in range(3):
                page.locator('.zbtn[data-z="1"]').click()
                page.wait_for_timeout(150)
            z['wPlus3'] = w()
            z['ovText'] = page.evaluate("() => { const a = []; for (const t of document.querySelectorAll('.zoomer svg text')) { const m = t.getScreenCTM(); a.push(parseFloat(t.getAttribute('font-size')) * Math.hypot(m.a, m.b)); } a.sort((x, y) => x - y); return a.length ? [a[0], a[a.length >> 1]] : null; }")
            record('zoom', b0, bag=b0, shot_name='screen-7-zoom')
            for i in range(5):
                page.locator('.zbtn[data-z="-1"]').click()
                page.wait_for_timeout(150)
            z['wMinus'] = w()
            page.locator('.zoomer [data-close]').first.click()
            page.wait_for_timeout(200)
            z['closed'] = page.locator('.zoomer').count() == 0
            feats['zoom'] = z
    ctx.close()
    return screens, feats


# ---------------------------------------------------------------- 3. 印刷 PDF
def pdf_boxes(data: bytes):
    """PDF のページ数と大きさ(mm)。圧縮されていないページ辞書から読む"""
    boxes = []
    for m in re.finditer(rb'/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]', data):
        x0, y0, x1, y1 = map(float, m.groups())
        boxes.append((round((x1 - x0) * 25.4 / 72, 1), round((y1 - y0) * 25.4 / 72, 1)))
    count = len(re.findall(rb'/Type\s*/Page(?![s\w])', data))
    return count, boxes


PRINT_DOM_JS = """() => {
  const pages = [...document.querySelectorAll('#print-area .print-page')];
  const px2mm = 25.4 / 96;
  const out = { n: pages.length, sizes: [], square: null, labels: [], bodyKids: [] };
  for (const p of pages) { const r = p.getBoundingClientRect(); out.sizes.push([+(r.width * px2mm).toFixed(1), +(r.height * px2mm).toFixed(1)]); const s = p.querySelector('svg'); out.labels.push(s && s.getAttribute('data-page')); }
  const svg = pages[0] && pages[0].querySelector('svg');
  if (svg) for (const r of svg.querySelectorAll('rect')) if (r.getAttribute('width') === '50' && r.getAttribute('height') === '50') {
    const b = r.getBoundingClientRect(); out.square = [+(b.width * px2mm).toFixed(2), +(b.height * px2mm).toFixed(2)];
  }
  for (const el of document.body.children) {
    const cs = getComputedStyle(el);
    if (el.id === 'print-area' || cs.display === 'none' || el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0) out.bodyKids.push({ tag: el.tagName, cls: String(el.className), h: Math.round(r.height), pos: cs.position });
  }
  return out;
}"""


def run_pdf(browser, base, bag_id, size, paper='A4'):
    """まず1枚 → 5cmでしたか → 残りを印刷、を page.pdf で2回とる"""
    ctx = browser.new_context(viewport={'width': 1000, 'height': 900}, service_workers='block', locale='ja-JP')
    page = ctx.new_page()
    con = Console(page)
    page.goto(base + 'index.html', wait_until='load')
    page.evaluate("([s, p]) => localStorage.setItem('bag-katagami.v1', JSON.stringify({size: s, paper: p, hintShown: true, printRoute: 'pc'}))", [size, paper])
    page.goto(base + f'index.html#/b/{bag_id}/print', wait_until='load')
    page.reload(wait_until='load')
    wait_screen(page)
    expect = page.evaluate("async ([b, s, p]) => { const B = await import('./js/bags/index.js'); const P = await import('./js/print.js'); const r = P.printPages(B.BAGS.find(x => x.id === b), s, {paper: p}); return r.labels || []; }", [bag_id, size, paper])
    page.evaluate("() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }")
    res = {'bag': bag_id, 'size': size, 'paper': paper, 'expect': expect, 'steps': []}
    for step, sel in (('1枚目', '#print-one'), ('残り', '#print-rest')):
        loc = page.locator(sel)
        if not loc.count():
            res['steps'].append({'step': step, 'missing': sel})
            break
        n0 = page.evaluate('window.__printed || 0')
        loc.click()
        page.wait_for_function(f'() => (window.__printed || 0) > {n0}', timeout=5000)
        if step == '1枚目':
            q = page.evaluate("() => { const a = document.querySelector('.ask'); return a ? a.innerText.slice(0, 80) : null; }")
        page.emulate_media(media='print')
        dom = page.evaluate(PRINT_DOM_JS)
        pdf_path = OUT / f'print-{bag_id}-{size}-{paper}-{"1" if step == "1枚目" else "rest"}.pdf'
        page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True)
        page.emulate_media(media='screen')
        count, boxes = pdf_boxes(pdf_path.read_bytes())
        png = pdf_path.with_suffix('.png')
        os.system(f'sips -s format png "{pdf_path}" --out "{png}" >/dev/null 2>&1')
        res['steps'].append({'step': step, 'dom': dom, 'pdfPages': count, 'pdfBoxes': boxes, 'pdf': str(pdf_path.relative_to(ROOT)),
                             'png': str(png.relative_to(ROOT)) if png.exists() else None})
        if step == '1枚目':
            page.wait_for_timeout(700)
            res['ask'] = page.evaluate("() => { const a = document.querySelector('.ask'); return a ? a.innerText.replace(/\\s+/g, ' ').slice(0, 120) : null; }")
            if not len(expect) > 1:
                break
    res['errors'] = [c for c in con.take() if c[0] in ('error', 'pageerror')]
    ctx.close()
    return res


def run_azuma(browser, base):
    ctx = browser.new_context(viewport=PHONE, service_workers='block', locale='ja-JP')
    page = ctx.new_page()
    page.goto(base + 'index.html#/b/wa-azuma/print', wait_until='load')
    wait_screen(page)
    out = page.evaluate("() => ({ h1: (document.querySelector('#screen h1') || {}).textContent, text: document.querySelector('#screen').innerText.slice(0, 200), memo: !!document.querySelector('#print-memo'), square: /5cm/.test(document.querySelector('#screen').innerText) })")
    out['shot'] = str((OUT / 'new-4-azuma-print.png').relative_to(ROOT))
    page.screenshot(path=str(OUT / 'new-4-azuma-print.png'))
    ctx.close()
    return out


# ---------------------------------------------------------------- 4. オフライン
def run_offline(browser, base, bag_id='tote-basic'):
    ctx = browser.new_context(viewport=PHONE, locale='ja-JP')   # service worker を使う
    page = ctx.new_page()
    con = Console(page)
    out = {}
    page.goto(base + 'index.html', wait_until='load')
    try:
        page.wait_for_function("async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }", timeout=15000)
        out['swReady'] = True
    except Exception as e:
        out['swReady'] = False
        out['err'] = str(e)[:200]
    page.reload(wait_until='load')
    page.wait_for_timeout(800)
    out['controlled'] = page.evaluate('!!navigator.serviceWorker.controller')
    # 一度ひととおり開く(見る・型紙・印刷・作り方)
    for sub in ['', '/pattern', '/print', '/steps']:
        page.evaluate("(h) => location.hash = h", f'#/b/{bag_id}{sub}')
        wait_screen(page)
        page.wait_for_timeout(600 if sub == '' else 200)
    out['cached'] = page.evaluate("async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return { keys: ks, n }; }")
    con.take()
    ctx.set_offline(True)
    checks = {}
    for label, h in [('はじめ', '#/'), ('見る', f'#/b/{bag_id}'), ('型紙', f'#/b/{bag_id}/pattern'), ('作り方', f'#/b/{bag_id}/steps'), ('ほかの袋(未表示)', '#/b/po-gama/pattern')]:
        try:
            page.goto(base + 'index.html' + h, wait_until='load', timeout=15000)
            page.reload(wait_until='load', timeout=15000)
            wait_screen(page)
            page.wait_for_timeout(500)
            checks[label] = page.evaluate("() => ({ h1: (document.querySelector('#screen h1') || {}).textContent || '', broken: !!document.querySelector('#screen .empty, #screen .notice'), canvas: !!document.querySelector('#stage canvas'), svg: !!document.querySelector('#screen svg') })")
        except Exception as e:
            checks[label] = {'error': str(e)[:160]}
    page.screenshot(path=str(OUT / 'new-5-offline.png'))
    out['shot'] = str((OUT / 'new-5-offline.png').relative_to(ROOT))
    out['checks'] = checks
    out['errors'] = [c for c in con.take() if c[0] in ('error', 'pageerror')][:8]
    ctx.close()
    return out


# ---------------------------------------------------------------- 報告
def md_report(data, ui, pdfs, args, extra=None):
    L = ['# 総合チェックの結果', '', f'- 日時: {time.strftime("%Y-%m-%d %H:%M")}', f'- 引数: `{" ".join(sys.argv[1:]) or "(なし)"}`', '']
    issues = []  # (重さ, 文)
    if data:
        L += ['## 1. 型紙のデータ(袋 × 大きさ)', '',
              f"袋の数: {data['count']}(仲間ごと: " + '、'.join(f"{g['name']} {g['n']}" for g in data['groups']) + f")/ 調べた時間 {data['seconds']} 秒", '',
              '| 袋 | 大 | パーツ | 線引き | 作り方 | 用意 | 合わせ差max | A4 枚(縦横) | A3 枚 | 白紙 | 5cm□ | はみ出し文字 | 切れ | エラー・注意 |',
              '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
        for b in data['bags']:
            for p in b['problems']:
                issues.append((p['sev'], f"{b['id']}: {p['msg']}"))
            for sz, r in b['sizes'].items():
                a4, a3 = r.get('A4') or {}, r.get('A3') or {}
                sq = a4.get('square')
                sqt = '—' if not sq else (f"{sq['w']:.1f}" + ('' if sq['inPage'] else '(外)'))
                blank = ','.join(a4.get('blank', []) + [f'A3:{x}' for x in a3.get('blank', [])]) or '—'
                notes = r['errors'] + r['warn'] + (r.get('matchBad') or [])
                L.append(f"| {b['id']} | {sz} | {r.get('pieces', '?')} | {r.get('measureOnly', '')} | {r.get('steps', '?')} | {r.get('extras', '?')} | "
                         f"{r.get('matchMax', 0):.1f}({r.get('matches', 0)}) | {a4.get('pages', '?')}({a4.get('cols', '?')}×{a4.get('rows', '?')} {('横' if a4.get('orient') == 'landscape' else '縦')}) | "
                         f"{a3.get('pages', '—')} | {blank} | {sqt} | {a4.get('outText', 0) + a3.get('outText', 0)} | {a4.get('coverMiss', 0) + a3.get('coverMiss', 0)} | "
                         f"{'<br>'.join(notes) if notes else 'OK'} |")
                for e in r['errors']:
                    issues.append((1, f"{b['id']} {sz}: {e}"))
                for e in r.get('matchBad') or []:
                    issues.append((2, f"{b['id']} {sz}: 縫い合わせる辺の長さが合わない {e}"))
                for e in r['warn']:
                    issues.append((3, f"{b['id']} {sz}: {e}"))
                for pp, info in (('A4', a4), ('A3', a3)):
                    if info.get('blank'):
                        issues.append((1, f"{b['id']} {sz} {pp}: 白紙(型紙の線がない)ページ {', '.join(info['blank'])}"))
                    if info.get('coverMiss'):
                        issues.append((1, f"{b['id']} {sz} {pp}: 型紙の線が どのページにも のらない所 {info['coverMiss']} 点"))
                    if info.get('badSize'):
                        issues.append((1, f"{b['id']} {sz} {pp}: 紙の大きさがちがうページ {info['badSize']}"))
                    if info.get('nan'):
                        issues.append((1, f"{b['id']} {sz} {pp}: SVG に NaN/undefined {info['nan']} ページ"))
                    if info.get('outText'):
                        issues.append((3, f"{b['id']} {sz} {pp}: 紙の外にはみ出す文字 {info['outText']}"))
                    if info.get('overlap'):
                        issues.append((2, f"{b['id']} {sz} {pp}: 並べたパーツが重なっている {info['overlap']} 組"))
                    sq = info.get('square')
                    printable = (r.get('pieces') or 0) - (r.get('measureOnly') or 0)
                    if info and not sq and printable > 0:
                        issues.append((1, f"{b['id']} {sz} {pp}: 1枚目に 5cm の四角がない"))
                    elif sq and (abs(sq['w'] - 50) > 0.2 or abs(sq['h'] - 50) > 0.2 or not sq['inPage']):
                        issues.append((1, f"{b['id']} {sz} {pp}: 5cm の四角が {sq['w']:.1f}×{sq['h']:.1f}mm {'' if sq['inPage'] else '(紙の外)'}"))
        L.append('')
    if ui:
        L += ['## 2. 画面(スマホ縦 390×844)', '',
              '| 画面 | 袋・仲間 | エラー | 横はみ出し | 20px未満の文字 | 64px未満のボタン | 3D | 画像 |', '|---|---|---|---|---|---|---|---|']
        tot_small, tot_btn = {}, {}
        for s in ui:
            st = s.get('stage')
            st_t = '' if not st else ('OK' if st.get('drawn') else ('canvasなし' if not st.get('canvas') else f"白い?({st.get('std')})"))
            L.append(f"| {s['kind']} | {s['label']} | {len(s['errors'])} | {s['overflowX'] if s['overflowX'] > 0 else 0} | {len(s['smallText'])} | {len(s['smallBtn'])} | {st_t} | {s.get('shot', '')} |")
            for e in s['errors']:
                issues.append((1, f"画面 {s['kind']} {s['label']}: {e[0]} {e[1][:160]}"))
            if s['overflowX'] > 0:
                issues.append((2, f"画面 {s['kind']} {s['label']}: 横に {s['overflowX']}px はみ出し {s['outside'][:3]}"))
            ot = s.get('ovText')
            if s['kind'] == 'pattern' and ot and ot['under12']:
                issues.append((2, f"画面 pattern {s['label']}: 全体図の文字が小さい(SVG の文字 {ot['n']} 個のうち 12px 未満 {ot['under12']}、いちばん小さい {ot['min']}px、まん中 {ot['median']}px)"))
            if s['broken']:
                issues.append((2, f"画面 {s['kind']} {s['label']}: 「準備中」などが出ている: {s['brokenText']}"))
            if st and st.get('drawn') is False:
                issues.append((1, f"画面 view {s['label']}: 3D が出ていない({'canvas なし' if not st.get('canvas') else '真っ白'})"))
            if s['kind'] == 'steps' and s.get('backTo') and not s['backTo'].endswith('/pattern'):
                issues.append((3, f"画面 steps {s['label']}: もどるで {s['backTo']} へ(型紙ではない)"))
            for t in s['smallText']:
                k = (s['kind'], t.get('cls') or t['tag'], t['fs'])
                tot_small.setdefault(k, [0, t['text']])[0] += 1
            for t in s['smallBtn']:
                k = (s['kind'], t.get('cls') or '', t['h'])
                tot_btn.setdefault(k, [0, t['text']])[0] += 1
        L += ['', '### 20px 未満の文字(種類ごと)', '', '| 画面 | class | 大きさ | 回数 | 例 |', '|---|---|---|---|---|']
        for (kind, cls, fs), (n, ex) in sorted(tot_small.items(), key=lambda x: -x[1][0]):
            L.append(f'| {kind} | {cls} | {fs}px | {n} | {ex} |')
            issues.append((3, f"画面 {kind}: 20px 未満の文字 .{cls} {fs}px × {n}(例「{ex}」)"))
        L += ['', '### 64px 未満のボタン(種類ごと)', '', '| 画面 | class | 高さ | 回数 | 例 |', '|---|---|---|---|---|']
        for (kind, cls, hh), (n, ex) in sorted(tot_btn.items(), key=lambda x: -x[1][0]):
            L.append(f'| {kind} | {cls} | {hh}px | {n} | {ex} |')
            issues.append((3, f"画面 {kind}: 64px 未満のボタン .{cls} 高さ {hh}px × {n}(例「{ex}」)"))
        L.append('')
    if pdfs:
        L += ['## 3. 印刷(page.pdf・まず1枚 → 残り)', '', '| 袋 | 大 | 紙 | 段 | 出した紙 | PDF ページ | PDF の大きさ(mm) | 5cm□(mm) | 画像 |', '|---|---|---|---|---|---|---|---|---|']
        for p in pdfs:
            want = (210.0, 297.0) if p['paper'] == 'A4' else (297.0, 420.0)
            exp = p.get('expect') or []
            for st in p['steps']:
                if st.get('missing'):
                    L.append(f"| {p['bag']} | {p['size']} | {p['paper']} | {st['step']} | ボタン {st['missing']} なし | | | | |")
                    if len(exp) > 1 or st['step'] == '1枚目':
                        issues.append((1, f"印刷 {p['bag']} {p['size']} {p['paper']}: {st['step']}のボタン {st['missing']} がない"))
                    continue
                d = st['dom']
                boxes = sorted(set(st['pdfBoxes']))
                L.append(f"| {p['bag']} | {p['size']} | {p['paper']} | {st['step']} | {','.join(map(str, d['labels']))} | {st['pdfPages']} | {boxes} | {d['square']} | {st.get('png') or ''} |")
                if st['pdfPages'] != d['n']:
                    issues.append((1, f"印刷 {p['bag']} {p['size']} {p['paper']} {st['step']}: PDF が {st['pdfPages']} ページ(紙は {d['n']} 枚)。白紙ページが混ざる"))
                if any(abs(b[0] - want[0]) > 0.6 or abs(b[1] - want[1]) > 0.6 for b in boxes):
                    issues.append((1, f"印刷 {p['bag']} {p['size']}: PDF の紙の大きさ {boxes}(ほしいのは {want})"))
                if st['step'] == '1枚目':
                    if d['labels'] != exp[:1]:
                        issues.append((1, f"印刷 {p['bag']} {p['size']} {p['paper']}: まず1枚 が {d['labels']}(ほしいのは {exp[:1]})"))
                    if not d['square'] or abs(d['square'][0] - 50) > 0.3 or abs(d['square'][1] - 50) > 0.3:
                        issues.append((1, f"印刷 {p['bag']} {p['size']} {p['paper']}: 5cm の四角が {d['square']} mm"))
                else:
                    if d['labels'] != exp[1:]:
                        issues.append((1, f"印刷 {p['bag']} {p['size']} {p['paper']}: 残りの印刷が {d['labels']}(ほしいのは 2枚目から {exp[1:]})"))
                for k in d['bodyKids']:
                    issues.append((2, f"印刷 {p['bag']}: 印刷のとき print-area 以外に見えているもの {k}"))
            if len(exp) > 1 and not (p.get('ask') or '').count('5cm'):
                issues.append((1, f"印刷 {p['bag']} {p['paper']}: 1枚目のあとに「5cmでしたか」が出ない({p.get('ask')})"))
            for e in p['errors']:
                issues.append((1, f"印刷 {p['bag']}: {e}"))
        L.append('')
    ex = extra or {}
    if ex.get('feats') is not None or ex.get('offline') or ex.get('azuma'):
        L += ['## 4. 新しい所の動き', '']
        f = ex.get('feats') or {}
        mv = f.get('miniView')
        L.append(f"- 柄を選んだときの小さな見本: {mv} {f.get('miniViewShot', '')}")
        if not mv or mv.get('hidden') or not mv.get('visible') or not mv.get('src'):
            issues.append((2, f"見る: 柄を選んでも 小さな見本が出ない {mv}"))
        r = f.get('routes') or {}
        for k in ['pc', 'phone', 'phone-android', 'phone-iphone', 'store']:
            v = r.get(k)
            L.append(f"- 印刷の道 {k}: {('押された=' + str(v['pressed']) + ' / ' + v['text'][:90].replace(chr(10), ' ')) if v else 'なし'}")
            if not v or v.get('pressed') != 'true':
                issues.append((2, f"印刷: 道 {k} のボタンが動かない {v}"))
        if r.get('phone-android') and r.get('phone-iphone') and r['phone-android']['text'] == r['phone-iphone']['text']:
            issues.append((2, '印刷: Android と iPhone で案内が変わらない'))
        for t in f.get('terms') or []:
            L.append(f"- ことばの説明({t['bag']}): ボタン {t.get('count')} 個、押した「{t.get('term')}」→ {t.get('open')}、わかったで閉じる {t.get('closedByBtn')}、うしろで閉じる {t.get('closedByBack')}、もどるで閉じる {t.get('closedByNav')} {t.get('shot', '')}")
            if not t.get('count'):
                issues.append((2, f"作り方 {t['bag']}: ことばの説明ボタンが 1つもない"))
            elif not t.get('open'):
                issues.append((1, f"作り方 {t['bag']}: ことばを押しても 説明の板が開かない"))
            else:
                for k, msg in (('closedByBtn', '「わかった」'), ('closedByBack', 'うしろを押す'), ('closedByNav', 'もどる')):
                    if not t.get(k):
                        issues.append((2, f"作り方 {t['bag']}: {msg}で 説明の板が閉じない"))
                if t['open'] and not t['open'].get('inView'):
                    issues.append((2, f"作り方 {t['bag']}: 説明の板が 画面からはみ出す"))
        z = f.get('zoom')
        L.append(f"- 大きく見る ＋−: {z}")
        if z and not (z['wPlus3'] > z['w0'] * 1.5 and z['wMinus'] <= z['w0'] + 2 and z['closed']):
            issues.append((2, f"型紙 大きく見る: ＋−・とじる が思うように動かない {z}"))
        az = ex.get('azuma')
        if az:
            L.append(f"- あずま袋の印刷: 見出し「{az['h1']}」 寸法の紙ボタン {az['memo']} {az['shot']}")
            if '印刷はいりません' not in (az['h1'] or ''):
                issues.append((2, f"あずま袋の印刷: 「印刷はいりません」が出ない({az['h1']})"))
        off = ex.get('offline')
        if off:
            L += ['', '### オフライン(一度開いたあと、ネットを切って開く)', '', f"- service worker: 準備 {off.get('swReady')} / 画面をあずかる {off.get('controlled')} / 控え {off.get('cached')}"]
            for k, v in (off.get('checks') or {}).items():
                L.append(f"- {k}: {v}")
                if v.get('error') or not v.get('h1') or v.get('broken'):
                    issues.append((1 if k != 'ほかの袋(未表示)' else 2, f"オフライン {k}: 開けない {v}"))
            L.append(f"- 画像: {off.get('shot')}")
        L.append('')
    # 問題のまとめ
    issues.sort(key=lambda x: x[0])
    name = {1: '重い', 2: 'ふつう', 3: '軽い'}
    L.insert(5, f"**問題 {len(issues)} 件**(重い {sum(1 for i in issues if i[0] == 1)} / ふつう {sum(1 for i in issues if i[0] == 2)} / 軽い {sum(1 for i in issues if i[0] == 3)})\n")
    L += ['## 問題の一覧(重い順)', '']
    for sev, msg in issues:
        L.append(f'- [{name[sev]}] {msg}')
    return '\n'.join(L) + '\n', issues


def main():
    ap = argparse.ArgumentParser(description='バッグの型紙アプリの総合チェック')
    ap.add_argument('--bag', action='append', help='袋の id(何回でも)')
    ap.add_argument('--size', choices=['S', 'M', 'L'], action='append', help='大きさ(何回でも)。画面は最初の1つで見る')
    ap.add_argument('--quick', action='store_true', help='速く')
    ap.add_argument('--only', default='data,ui,pdf,offline', help='data,ui,pdf,offline のどれを走らせるか')
    ap.add_argument('--pdf-bag', default=None, help='PDF を作る袋(省くと --bag の最初、なければ tote-basic と大きな袋)')
    ap.add_argument('--pdf-size', default=None)
    args = ap.parse_args()
    only = set(args.only.split(','))
    OUT.mkdir(exist_ok=True)
    for f in list(OUT.glob('*.png')) + list(OUT.glob('*.pdf')):
        f.unlink()
    srv, base = start_server()
    print(f'サーバー {base}')
    data = ui = None
    pdfs = []
    extra = {}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chrome', headless=True,
                                         args=['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            if 'data' in only:
                page = browser.new_page(service_workers='block')
                c = Console(page)
                print('型紙のデータを調べています…')
                data = run_data(page, base, args.bag, args.size, args.quick)
                errs = [x for x in c.take() if x[0] in ('error', 'pageerror')]
                if errs:
                    print('  コンソール:', errs[:5])
                page.close()
            if 'ui' in only:
                print('画面の流れを調べています…')
                shots = {'done': set(), 'problems': 0, 'max_problems': 12}
                ui, feats = run_ui(browser, base, args.bag, (args.size or ['M'])[0], args.quick, shots)
                extra['feats'] = feats
                if not args.bag or 'wa-azuma' in args.bag:
                    extra['azuma'] = run_azuma(browser, base)
            if 'pdf' in only:
                print('印刷の PDF を作っています…')
                targets = []
                if args.pdf_bag:
                    targets.append((args.pdf_bag, args.pdf_size or 'M'))
                elif args.bag:
                    targets.append((args.bag[0], args.pdf_size or (args.size or ['M'])[0]))
                else:
                    targets += [('tote-basic', 'L'), ('po-gama', 'M')]
                for bid, sz in targets:
                    for pp in (['A4'] if args.quick else ['A4', 'A3']):
                        try:
                            pdfs.append(run_pdf(browser, base, bid, sz, pp))
                        except Exception as e:
                            print('  PDF 失敗', bid, pp, e)
            if 'offline' in only:
                print('オフラインを調べています…')
                extra['offline'] = run_offline(browser, base)
            browser.close()
    finally:
        srv.shutdown()
        srv.server_close()
        print('サーバーを止めました')
    md, issues = md_report(data, ui, pdfs, args, extra)
    (OUT / 'report.md').write_text(md, encoding='utf-8')
    (OUT / 'report.json').write_text(json.dumps({'data': data, 'ui': ui, 'pdf': pdfs, 'extra': extra}, ensure_ascii=False, indent=1), encoding='utf-8')
    heavy = [i for i in issues if i[0] == 1]
    print(f'問題 {len(issues)} 件(重い {len(heavy)})→ {OUT / "report.md"}')
    for sev, msg in issues[:15]:
        print(f'  [{sev}] {msg}')
    return 1 if heavy else 0


if __name__ == '__main__':
    sys.exit(main())

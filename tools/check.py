#!/usr/bin/env python3
"""バッグの型紙アプリ 総合チェック(総合チェック係)

使い方:
  source ~/.local/venvs/ryokoshi/bin/activate
  python3 tools/check.py                 # ぜんぶ(30袋 × S/M/L、画面、印刷PDF)
  python3 tools/check.py --quick         # 速く(A4 だけ・1ページ目だけ調べる・画面はグループの先頭の袋だけ)
  python3 tools/check.py --bag tote-basic --size M   # 1袋だけ
  python3 tools/check.py --only data     # data / ui / pdf のどれかだけ(カンマで複数)
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


def run_ui(browser, base, bag_ids, size, quick, shots):
    ctx = browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True,
                              service_workers='block', locale='ja-JP')
    page = ctx.new_page()
    con = Console(page)
    screens = []

    def record(kind, label, bag=None, shot_name=None, extra=None):
        m = page.evaluate(MEASURE_JS)
        errs = [c for c in con.take() if c[0] in ('error', 'pageerror', 'requestfailed') or c[0].startswith('http')]
        warns = [c for c in con.items if c[0] == 'warning']
        rec = {'kind': kind, 'label': label, 'bag': bag, 'hash': page.evaluate('location.hash'),
               'overflowX': m['overflowX'], 'outside': m['outside'], 'smallText': m['smallText'], 'smallBtn': m['smallBtn'],
               'errors': errs, 'h1': m['h1'].strip(), 'broken': m['broken'], 'brokenText': m['brokenText']}
        if extra:
            rec.update(extra)
        problem = errs or m['overflowX'] > 0 or m['broken'] or (extra and extra.get('stage', {}).get('drawn') is False)
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
    # 大きさを決めておく(保存の場所に書く)
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
        # はじめ → 仲間(ボタンを押す)
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
            page.evaluate("(id) => location.hash = '#/g/' + id", g['id'])
            wait_screen(page)
            page.evaluate("(id) => location.hash = '#/b/' + id", bid)
            wait_screen(page)
            st = stage_drawn(page)
            first = (gi == 0 and bi == 0)
            record('view', bid, bag=bid, shot_name='screen-3-view' if first else None, extra={'stage': st})
            # 見る → 型紙(ボタン)
            btn = page.locator('#to-pattern')
            if btn.count():
                btn.click()
            else:
                page.evaluate("(id) => location.hash = '#/b/' + id + '/pattern'", bid)
            wait_screen(page)
            record('pattern', bid, bag=bid, shot_name='screen-4-pattern' if first else None)
            btn = page.locator('#to-print')
            if btn.count():
                btn.click()
            else:
                page.evaluate("(id) => location.hash = '#/b/' + id + '/print'", bid)
            wait_screen(page)
            record('print', bid, bag=bid, shot_name='screen-5-print' if first else None)
            btn = page.locator('#to-steps')
            if btn.count():
                btn.click()
            else:
                page.evaluate("(id) => location.hash = '#/b/' + id + '/steps'", bid)
            wait_screen(page)
            rec = record('steps', bid, bag=bid, shot_name='screen-6-steps' if first else None)
            # もどる が 型紙へ戻るか
            page.locator('#back').click()
            wait_screen(page)
            rec['backTo'] = page.evaluate('location.hash')
    # 型紙の「大きく見る」
    if screens:
        b0 = bag_ids[0] if bag_ids else groups[0]['bags'][0]
        page.evaluate("(id) => location.hash = '#/b/' + id + '/pattern'", b0)
        wait_screen(page)
        if page.locator('#ov').count():
            page.locator('#ov').click()
            page.wait_for_timeout(400)
            record('zoom', b0, bag=b0, shot_name='screen-7-zoom')
    ctx.close()
    return screens


# ---------------------------------------------------------------- 3. 印刷 PDF
def pdf_boxes(data: bytes):
    """PDF のページ数と大きさ(mm)。圧縮されていないページ辞書から読む"""
    boxes = []
    for m in re.finditer(rb'/Type\s*/Page[^s].{0,400}?/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]', data, re.S):
        x0, y0, x1, y1 = map(float, m.groups())
        boxes.append((round((x1 - x0) * 25.4 / 72, 1), round((y1 - y0) * 25.4 / 72, 1)))
    if not boxes:
        for m in re.finditer(rb'/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]', data):
            x0, y0, x1, y1 = map(float, m.groups())
            boxes.append((round((x1 - x0) * 25.4 / 72, 1), round((y1 - y0) * 25.4 / 72, 1)))
    count = len(re.findall(rb'/Type\s*/Page(?![s\w])', data))
    return count, boxes


def run_pdf(browser, base, bag_id, size, paper='A4'):
    ctx = browser.new_context(viewport={'width': 1000, 'height': 900}, service_workers='block', locale='ja-JP')
    page = ctx.new_page()
    con = Console(page)
    page.goto(base + 'index.html', wait_until='load')
    page.evaluate("([s, p]) => localStorage.setItem('bag-katagami.v1', JSON.stringify({size: s, paper: p, hintShown: true}))", [size, paper])
    page.goto(base + f'index.html#/b/{bag_id}/print', wait_until='load')
    page.reload(wait_until='load')
    wait_screen(page)
    page.evaluate("() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }")
    page.locator('#print-all').click()
    page.wait_for_function('() => window.__printed > 0', timeout=5000)
    page.emulate_media(media='print')
    m = page.evaluate("""() => {
      const pages = [...document.querySelectorAll('#print-area .print-page')];
      const px2mm = 25.4 / 96;
      const out = { n: pages.length, sizes: [], square: null, firstLabel: null, bodyKids: [] };
      for (const p of pages) { const r = p.getBoundingClientRect(); out.sizes.push([+(r.width * px2mm).toFixed(1), +(r.height * px2mm).toFixed(1)]); }
      const svg = pages[0] && pages[0].querySelector('svg');
      if (svg) {
        out.firstLabel = svg.getAttribute('data-page');
        for (const r of svg.querySelectorAll('rect')) if (r.getAttribute('width') === '50' && r.getAttribute('height') === '50') {
          const b = r.getBoundingClientRect(); out.square = [+(b.width * px2mm).toFixed(2), +(b.height * px2mm).toFixed(2)];
        }
      }
      // 印刷のとき見えている、print-area 以外のもの(白紙ページの原因になる)
      for (const el of document.body.children) {
        const cs = getComputedStyle(el);
        if (el.id === 'print-area' || cs.display === 'none' || el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') continue;
        const r = el.getBoundingClientRect();
        out.bodyKids.push({ tag: el.tagName, cls: String(el.className), h: Math.round(r.height), pos: cs.position });
      }
      return out;
    }""")
    pdf_path = OUT / f'print-{bag_id}-{size}-{paper}.pdf'
    page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True)
    data = pdf_path.read_bytes()
    count, boxes = pdf_boxes(data)
    # 1ページ目を絵にする(macOS の sips)
    png = OUT / f'print-{bag_id}-{size}-{paper}-p1.png'
    os.system(f'sips -s format png "{pdf_path}" --out "{png}" >/dev/null 2>&1')
    errs = [c for c in con.take() if c[0] in ('error', 'pageerror')]
    ctx.close()
    return {'bag': bag_id, 'size': size, 'paper': paper, 'dom': m, 'pdfPages': count, 'pdfBoxes': boxes,
            'pdf': str(pdf_path.relative_to(ROOT)), 'png': str(png.relative_to(ROOT)) if png.exists() else None, 'errors': errs}


# ---------------------------------------------------------------- 報告
def md_report(data, ui, pdfs, args):
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
                    if info and not sq:
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
        L += ['## 3. 印刷(page.pdf)', '', '| 袋 | 大 | 紙 | 画面のページ数 | PDF のページ数 | PDF の大きさ(mm) | 5cm□(mm) | 画像 |', '|---|---|---|---|---|---|---|---|']
        for p in pdfs:
            d = p['dom']
            boxes = sorted(set(p['pdfBoxes']))
            L.append(f"| {p['bag']} | {p['size']} | {p['paper']} | {d['n']} | {p['pdfPages']} | {boxes} | {d['square']} | {p.get('png') or ''} |")
            want = (210.0, 297.0) if p['paper'] == 'A4' else (297.0, 420.0)
            if p['pdfPages'] != d['n']:
                issues.append((1, f"印刷 {p['bag']} {p['size']}: PDF が {p['pdfPages']} ページ(型紙は {d['n']} 枚)。白紙ページが混ざる"))
            if any(abs(b[0] - want[0]) > 0.6 or abs(b[1] - want[1]) > 0.6 for b in boxes):
                issues.append((1, f"印刷 {p['bag']} {p['size']}: PDF の紙の大きさ {boxes}(ほしいのは {want})"))
            if not d['square'] or abs(d['square'][0] - 50) > 0.3 or abs(d['square'][1] - 50) > 0.3:
                issues.append((1, f"印刷 {p['bag']} {p['size']}: 5cm の四角が {d['square']} mm"))
            for k in d['bodyKids']:
                if k['h'] > 0:
                    issues.append((2, f"印刷 {p['bag']}: 印刷のとき print-area 以外に見えているもの {k}"))
            for e in p['errors']:
                issues.append((1, f"印刷 {p['bag']}: {e}"))
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
    ap.add_argument('--only', default='data,ui,pdf', help='data,ui,pdf のどれを走らせるか')
    ap.add_argument('--pdf-bag', default=None, help='PDF を作る袋(省くと --bag の最初、なければ tote-basic と大きな袋)')
    ap.add_argument('--pdf-size', default=None)
    args = ap.parse_args()
    only = set(args.only.split(','))
    OUT.mkdir(exist_ok=True)
    for f in OUT.glob('*.png'):
        f.unlink()
    srv, base = start_server()
    print(f'サーバー {base}')
    data = ui = None
    pdfs = []
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
                ui = run_ui(browser, base, args.bag, (args.size or ['M'])[0], args.quick, shots)
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
                    try:
                        pdfs.append(run_pdf(browser, base, bid, sz, 'A4'))
                        if not args.quick:
                            pdfs.append(run_pdf(browser, base, bid, sz, 'A3'))
                    except Exception as e:
                        print('  PDF 失敗', bid, e)
            browser.close()
    finally:
        srv.shutdown()
        srv.server_close()
        print('サーバーを止めました')
    md, issues = md_report(data, ui, pdfs, args)
    (OUT / 'report.md').write_text(md, encoding='utf-8')
    (OUT / 'report.json').write_text(json.dumps({'data': data, 'ui': ui, 'pdf': pdfs}, ensure_ascii=False, indent=1), encoding='utf-8')
    heavy = [i for i in issues if i[0] == 1]
    print(f'問題 {len(issues)} 件(重い {len(heavy)})→ {OUT / "report.md"}')
    for sev, msg in issues[:15]:
        print(f'  [{sev}] {msg}')
    return 1 if heavy else 0


if __name__ == '__main__':
    sys.exit(main())

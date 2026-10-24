// check.py がブラウザの中で動かす「型紙のしらべ」。(総合チェック係)
// page.evaluate(このファイルの中身, {bags, sizes}) → 結果の配列
async ({ bags: onlyBags, sizes: onlySizes, quick }) => {
  const base = location.origin + '/';
  const B = await import(base + 'js/bags/index.js');
  const P = await import(base + 'js/print.js');
  const G = await import(base + 'js/geom.js');
  const FAMILIES = ['flat', 'boxed', 'gusset', 'cylinder', 'halfmoon', 'trapezoid', 'backpack', 'round', 'envelope', 'gathered', 'knot', 'azuma'];
  const FABRICS = ['outer', 'lining', 'interfacing', 'accent'];
  const MARKS = ['notch', 'dot', 'line', 'text'];
  const out = [];
  const bags = B.BAGS.filter((b) => !onlyBags || onlyBags.includes(b.id));

  // 画面に SVG を置いて、中の線が 印刷できる範囲に入っているかを見る
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:0;top:0;width:2100px;visibility:hidden;pointer-events:none';
  document.body.appendChild(host);

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const ptOk = (p) => Array.isArray(p) && isNum(p[0]) && isNum(p[1]);

  function inspectPage(svgStr, paper) {
    host.innerHTML = svgStr;
    const svg = host.querySelector('svg');
    const res = { wmm: null, hmm: null, ink: 0, square: null, label: svg.getAttribute('data-page') };
    res.wmm = parseFloat(svg.getAttribute('width'));
    res.hmm = parseFloat(svg.getAttribute('height'));
    const [PW, PH] = P.PAPERS[paper];
    const vb = svg.viewBox.baseVal;
    svg.style.width = (PW * 10) + 'px'; svg.style.height = (PH * 10) + 'px';
    const sr = svg.getBoundingClientRect();
    const k = sr.width / vb.width; // px / mm
    const M = P.MARGIN;
    // パーツの線のうち、印刷できる範囲(余白の内側)に入る点の数
    const inside = (x, y) => x >= sr.left + M * k && x <= sr.right - M * k && y >= sr.top + M * k && y <= sr.bottom - M * k;
    let ink = 0;
    for (const path of svg.querySelectorAll('g[data-piece] path')) {
      let L = 0;
      try { L = path.getTotalLength(); } catch (e) { continue; }
      if (!L) continue;
      const m = path.getScreenCTM();
      const n = Math.min(400, Math.max(8, Math.ceil(L / 2)));
      for (let i = 0; i <= n; i++) {
        const q = path.getPointAtLength((L * i) / n);
        const x = m.a * q.x + m.c * q.y + m.e, y = m.b * q.x + m.d * q.y + m.f;
        if (inside(x, y)) { ink++; }
      }
    }
    res.ink = ink;
    // 5cm の四角
    for (const r of svg.querySelectorAll('rect')) {
      if (r.getAttribute('width') === '50' && r.getAttribute('height') === '50') {
        const b = r.getBoundingClientRect();
        res.square = { w: b.width / k, h: b.height / k, inPage: b.left >= sr.left && b.right <= sr.right && b.top >= sr.top && b.bottom <= sr.bottom };
      }
    }
    // 文字がページの外にはみ出していないか
    let outText = 0;
    for (const t of svg.querySelectorAll('text')) {
      if (t.closest('[clip-path]')) continue; // 切りとられる中の文字は となりのページに続く
      const b = t.getBoundingClientRect();
      if (!b.width) continue;
      if (b.left < sr.left - 0.5 || b.right > sr.right + 0.5 || b.top < sr.top - 0.5 || b.bottom > sr.bottom + 0.5) outText++;
    }
    res.outText = outText;
    // 切りとり(clip)の外の 説明の文字の大きさ(mm)
    let minTxt = 99;
    for (const t of svg.querySelectorAll('text')) {
      const fs = parseFloat(t.getAttribute('font-size'));
      if (fs > 0) minTxt = Math.min(minTxt, fs);
    }
    res.minTxt = minTxt;
    host.innerHTML = '';
    return res;
  }

  // パーツの切る線が、どれかのページに全部のっているか
  function coverage(bag, size, paper) {
    const plan = P.printPlan(bag, size, { paper });
    const { tile, pu, lay } = plan;
    let miss = 0, total = 0;
    for (const it of lay.items) {
      const poly = it.geom.cut.map((p) => [p[0] + it.x, p[1] + it.y]);
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5));
        for (let s = 0; s < n; s++) {
          const x = a[0] + ((b[0] - a[0]) * s) / n, y = a[1] + ((b[1] - a[1]) * s) / n;
          total++;
          let ok = false;
          for (let r = 0; r < pu.rows && !ok; r++) for (let c = 0; c < pu.cols && !ok; c++) {
            if (!pu.used[r][c]) continue;
            const X = c * tile.sx, Y = r * tile.sy;
            if (x >= X - 0.01 && x <= X + tile.tw + 0.01 && y >= Y - 0.01 && y <= Y + tile.th + 0.01) ok = true;
          }
          if (!ok) miss++;
        }
      }
    }
    // パーツどうしが重なっていないか(外わくの四角で)
    let overlap = 0;
    const its = lay.items;
    for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) {
      const a = its[i], b = its[j];
      if (a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5) overlap++;
    }
    return { miss, total, overlap, orient: plan.orient };
  }

  for (const bag of bags) {
    const bagRow = { id: bag.id, name: bag.name, group: bag.group, level: bag.level, trend: !!bag.trend, problems: [], sizes: {} };
    const pr = (sev, msg) => bagRow.problems.push({ sev, msg });
    if (!bag.desc) pr(2, 'desc がない');
    if (![1, 2, 3].includes(bag.level)) pr(2, `level が ${bag.level}`);
    if (!B.GROUPS.find((g) => g.id === bag.group)) pr(1, `group ${bag.group} が GROUPS にない`);
    for (const sz of ['S', 'M', 'L']) {
      if (onlySizes && !onlySizes.includes(sz)) continue;
      const row = { errors: [], warn: [] };
      bagRow.sizes[sz] = row;
      const err = (k, e) => row.errors.push(`${k}: ${e && e.message ? e.message : e}`);
      if (!bag.sizes || !bag.sizes[sz]) { row.errors.push(`sizes.${sz} がない`); continue; }
      if (!bag.sizeNote || !bag.sizeNote[sz]) row.warn.push(`sizeNote.${sz} がない`);
      const p = { ...bag.sizes[sz], key: sz, size: sz, sizeKey: sz };
      // shape
      try {
        const sh = bag.shape(p);
        row.family = sh.family;
        if (!FAMILIES.includes(sh.family)) row.warn.push(`shape.family "${sh.family}" は約束にない`);
        for (const k of ['w', 'h']) if (!isNum(sh[k]) || sh[k] <= 0) row.errors.push(`shape.${k} が ${sh[k]}`);
        if (sh.handles && !Array.isArray(sh.handles)) row.errors.push('shape.handles が配列でない');
      } catch (e) { err('shape', e); }
      // pieces
      let pieces = [];
      try {
        pieces = bag.pieces(p) || [];
        row.pieces = pieces.length;
        row.measureOnly = pieces.filter((x) => x && x.measureOnly).length;
        const ids = new Set();
        for (const pc of pieces) {
          if (!pc) { row.errors.push('pieces に null'); continue; }
          if (ids.has(pc.id)) row.warn.push(`piece id "${pc.id}" が重複`);
          ids.add(pc.id);
          const nm = `${pc.name || pc.id}`;
          if (!Array.isArray(pc.outline) || pc.outline.length < 3) { row.errors.push(`${nm}: outline の点が足りない`); continue; }
          if (!pc.outline.every(ptOk)) { row.errors.push(`${nm}: outline に数でない点`); continue; }
          if (!FABRICS.includes(pc.fabric)) row.warn.push(`${nm}: fabric "${pc.fabric}"`);
          for (const m of (pc.more || [])) if (!FABRICS.includes(m.fabric)) row.warn.push(`${nm}: more.fabric "${m.fabric}"`);
          if (!(pc.cut >= 1)) row.warn.push(`${nm}: cut が ${pc.cut}`);
          if (!pc.measureOnly && !pc.grain) row.warn.push(`${nm}: 布目(grain)がない`);
          if (!pc.measureOnly) {
            const seams = P.seamArray(pc);
            if (seams.some((s) => !isNum(s) || s < 0)) row.errors.push(`${nm}: 縫い代が変 ${JSON.stringify(pc.seam)}`);
            if (seams.every((s) => s === 0)) row.warn.push(`${nm}: 縫い代が 0`);
            // 外へ縫い代を足した線が、できあがり線より大きいか(内向きの多角形だと逆になる)
            try {
              const a = G.bbox(pc.outline), b = G.bbox(P.cutOutline(pc));
              if (b.w < a.w - 0.5 || b.h < a.h - 0.5) row.errors.push(`${nm}: 切る線が できあがり線より小さい(点の向きが逆?)`);
            } catch (e) { err(`${nm} offset`, e); }
          }
          for (const m of (pc.marks || [])) {
            if (!MARKS.includes(m.type)) row.warn.push(`${nm}: 印 type "${m.type}"`);
            if (m.at && !ptOk(m.at)) row.errors.push(`${nm}: 印の位置が変`);
            if (m.pts && !m.pts.every(ptOk)) row.errors.push(`${nm}: 印の線が変`);
          }
          const bb = G.bbox(pc.outline);
          if (bb.w < 5 || bb.h < 5) row.warn.push(`${nm}: とても小さい ${bb.w.toFixed(0)}×${bb.h.toFixed(0)}mm`);
          if (pc.measureOnly && (bb.w > 1500 || bb.h > 1500)) row.warn.push(`${nm}: 布の幅より長い ${bb.w.toFixed(0)}mm`);
        }
        if (!pieces.length) row.errors.push('pieces が空');
      } catch (e) { err('pieces', e); }
      // matches
      try {
        const ms = P.checkMatches(bag, sz);
        row.matches = ms.length;
        row.matchBad = ms.filter((m) => !m.ok || !Number.isFinite(m.diff)).map((m) => `${m.label}: ${Number.isFinite(m.a) ? m.a.toFixed(1) : m.a} / ${Number.isFinite(m.b) ? m.b.toFixed(1) : m.b}(差 ${Number.isFinite(m.diff) ? m.diff.toFixed(1) : '?'}mm)`);
        row.matchMax = ms.reduce((mx, m) => Math.max(mx, Math.abs(m.diff) || 0), 0);
      } catch (e) { err('matches', e); }
      // steps / extras
      try {
        const st = bag.steps(p) || [];
        row.steps = st.length;
        if (st.length < 6 || st.length > 16) row.warn.push(`作り方が ${st.length} 手順(約束は 6〜16)`);
        if (st.some((s) => typeof s !== 'string' || !s.trim())) row.errors.push('作り方に空の手順');
        const long = st.filter((s) => s.length > 110);
        if (long.length) row.warn.push(`長い手順 ${long.length} 個(最大 ${Math.max(...st.map((s) => s.length))} 字)`);
        row.stepsText = st;
        // 単語の間のあき(日本語の字と字の間の半角・全角スペース)
        row.spaces = st.reduce((n, s) => n + (s.match(/[^\x00-\x7f][ 　][^\x00-\x7f(]/g) || []).length, 0);
        // 型紙を布に置いて印を写す手順があるか
        row.transfer = st.some((s) => /写/.test(s) && /(印|しるし)/.test(s));
      } catch (e) { err('steps', e); }
      try {
        const ex = bag.extras(p) || [];
        row.extras = ex.length;
        if (ex.some((s) => typeof s !== 'string')) row.errors.push('extras に文字でないもの');
      } catch (e) { err('extras', e); }
      // materials
      try {
        const mt = P.materials(bag, sz);
        row.materials = mt.map((m) => `${m.name} ${m.size}`).join(' / ');
        for (const m of mt) if (!(m.lengthCm > 0) || m.lengthCm > 400) row.warn.push(`布の量が変: ${m.name} ${m.size}`);
      } catch (e) { err('materials', e); }
      // overview
      try {
        const ov = P.overviewSVG(bag, sz, {});
        if (!ov || !ov.startsWith('<svg')) row.errors.push('overviewSVG が空');
        if (/NaN|undefined|Infinity/.test(ov)) row.errors.push('overviewSVG に NaN/undefined');
      } catch (e) { err('overviewSVG', e); }
      // print
      for (const paper of (quick ? ['A4'] : ['A4', 'A3'])) {
        try {
          const t0 = performance.now();
          const pp = P.printPages(bag, sz, { paper });
          const ms = performance.now() - t0;
          const info = { pages: pp.pages.length, cols: pp.cols, rows: pp.rows, orient: pp.orientation, ms: Math.round(ms), blank: [], badSize: 0, outText: 0, nan: 0 };
          pp.pages.forEach((svg, i) => {
            if (/NaN|undefined|Infinity/.test(svg)) info.nan++;
            if (quick && i > 0) return;
            const r = inspectPage(svg, paper);
            const [PW, PH] = P.PAPERS[paper];
            if (Math.abs(r.wmm - PW) > 0.01 || Math.abs(r.hmm - PH) > 0.01) info.badSize++;
            if (r.ink === 0 && i > 0) info.blank.push(r.label);
            info.outText += r.outText;
            if (i === 0) info.square = r.square;
            info.minTxt = Math.min(info.minTxt ?? 99, r.minTxt);
          });
          const cov = coverage(bag, sz, paper);
          info.coverMiss = cov.miss; info.overlap = cov.overlap;
          row[paper] = info;
          if (ms > 3000) row.warn.push(`${paper} の計算が遅い ${Math.round(ms)}ms`);
        } catch (e) { err(`printPages ${paper}`, e); }
      }
    }
    out.push(bagRow);
  }
  host.remove();
  let glossary = [];
  try { const Gl = await import(base + 'js/glossary.js'); glossary = Gl.GLOSSARY || []; } catch (e) { glossary = null; }
  return { glossary, count: B.BAGS.length, groups: B.GROUPS.map((g) => ({ id: g.id, name: g.name, n: B.BAGS.filter((b) => b.group === g.id).length })), bags: out };
}

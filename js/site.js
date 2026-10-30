/* Arris: the site's behaviour. Everything the page states about the font
 * (version, character count, the character set) comes from data/font.json,
 * written from the release by tools/fonts.py. One place in the designspace
 * (LOC) is shared: the map, the sliders, the presets and the specimen card
 * all follow it. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const two = n => String(n).padStart(2, '0');

  // the titanium colours: an oxide film thickening, one per weight 100..900
  const TI = ['#a8804c', '#804799', '#4554cc', '#4087e6', '#a8cced', '#f2cc61', '#e67891', '#9e66d1', '#45c7a8'];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function titanium(w) {
    const u = clamp((w - 100) / 800, 0, 1) * 8, i = Math.min(7, Math.floor(u)), f = u - i;
    const a = hex(TI[i]), b = hex(TI[i + 1]);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
  }
  const NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  const fvs = (w, g, x) => `"wght" ${Math.round(w)}, "GRAD" ${Math.round(g)}, "WTCH" ${Math.round(x)}`;

  /* ------------------------------------------------------------ the shared place */
  const AX = { wght: [100, 900], GRAD: [-100, 100], WTCH: [0, 100] };
  const LOC = { wght: 400, GRAD: 0, WTCH: 0, ital: false };
  const subs = [];
  function setLoc(p) {
    for (const k in p) LOC[k] = k === 'ital' ? p[k] : clamp(p[k], AX[k][0], AX[k][1]);
    subs.forEach(f => f(LOC));
  }

  /* ------------------------------------------------------------ the name */
  // the name hangs on a spring: the pointer (or the opening) pulls the
  // target, the name follows with a little overshoot, and when the pointer
  // leaves it springs back to rest in the middle of the weights; the ends of
  // the axes are hard stops, which the name lands on rather than sinks past
  const mark = $('#mark'), rw = $('#r-wght'), rx = $('#r-wtch');
  const REST = { w: 500, x: 0 }, K = 70, C = 2 * Math.sqrt(70) * 0.42, ENDS = { w: [100, 900], x: [0, 100] };
  const cur = reduce ? { ...REST } : { w: 900, x: 0 }, vel = { w: 0, x: 0 }, aim = reduce ? { ...REST } : { ...cur };
  let springing = false, last = 0, sweep = !reduce;
  function draw() {
    const w = Math.round(cur.w), x = Math.round(cur.x);
    mark.style.setProperty('--w', w); mark.style.setProperty('--x', x);
    rw.textContent = w; rx.textContent = x;
  }
  function spring(t) {
    const dt = Math.min(0.034, (t - last) / 1000 || 0.016); last = t;
    for (const k of ['w', 'x']) {
      vel[k] += (K * (aim[k] - cur[k]) - C * vel[k]) * dt;
      cur[k] += vel[k] * dt;
      if (cur[k] < ENDS[k][0] || cur[k] > ENDS[k][1]) { cur[k] = clamp(cur[k], ...ENDS[k]); vel[k] = 0; }
    }
    draw();
    if (sweep === true && aim.w === 100 && cur.w === 100) {
      sweep = 'landed';
      setTimeout(() => { if (sweep) { sweep = false; pull(REST.w, REST.x); } }, 160);
    }
    const still = Math.abs(aim.w - cur.w) < 0.5 && Math.abs(vel.w) < 0.5 && Math.abs(aim.x - cur.x) < 0.2 && Math.abs(vel.x) < 0.2;
    if (still) { cur.w = aim.w; cur.x = aim.x; draw(); springing = false; return; }
    requestAnimationFrame(spring);
  }
  function pull(w, x) {
    aim.w = w; aim.x = x;
    if (reduce) { cur.w = w; cur.x = x; draw(); return; }
    if (!springing) { springing = true; last = performance.now(); requestAnimationFrame(spring); }
  }
  function point(e) {
    sweep = false;
    const r = mark.getBoundingClientRect();
    pull(100 + 800 * clamp((e.clientX - r.left) / r.width, 0, 1), 100 * clamp((e.clientY - r.top) / r.height, 0, 1));
  }
  mark.addEventListener('pointermove', point);
  mark.addEventListener('pointerdown', point);
  mark.addEventListener('pointerleave', () => { sweep = false; pull(REST.w, REST.x); });
  draw();
  if (sweep) {
    // the opening, once the face is in: Black, dropped to Thin, and let go
    // to rest in the middle
    document.fonts.load('1em Arris').catch(() => {}).then(() => setTimeout(() => { if (sweep) pull(100, 0); }, 450));
  }

  /* ------------------------------------------------------------ the watch */
  const watch = $('#watch'), wt = $('#watch-time'), wd = $('#watch-date');
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  let leakUntil = 0, shownTime = '';
  function tickWatch() {
    const d = new Date(), now = d.getTime();
    // now and then, for a moment, the watch shows another time
    if (now > leakUntil + 60000 && d.getSeconds() === 47 && Math.random() < 0.34) leakUntil = now + 1400;
    const leaking = now < leakUntil;
    watch.classList.toggle('leaking', leaking);
    const t = leaking ? '03:47' : `${two(d.getHours())}:${two(d.getMinutes())}`;
    if (t !== shownTime) { shownTime = t; wt.textContent = t; }
    wd.textContent = `${DAYS[d.getDay()]} ${two(d.getDate())}`;
  }
  tickWatch(); setInterval(tickWatch, 250);
  function pressSwitch(onBtn, offBtn, on) { onBtn.setAttribute('aria-pressed', on); offBtn.setAttribute('aria-pressed', !on); }
  $('#pix-on').addEventListener('click', () => { watch.classList.add('pixels'); pressSwitch($('#pix-on'), $('#pix-off'), true); });
  $('#pix-off').addEventListener('click', () => { watch.classList.remove('pixels'); pressSwitch($('#pix-on'), $('#pix-off'), false); });

  // the watch, and how it's built: two tabs on one instrument (arrow keys
  // move between them); opening how it's built runs it from the pixels
  const tabs = $$('.inst-tabs [role="tab"]');
  function showTab(t) {
    tabs.forEach(b => {
      const on = b === t;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
      $('#' + b.getAttribute('aria-controls')).hidden = !on;
    });
    if (t.id === 'tab-built') $('#tf').dispatchEvent(new Event('show'));
  }
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => showTab(b));
    b.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!k) return;
      const n = tabs[(i + k + tabs.length) % tabs.length];
      n.focus();
      showTab(n);
      e.preventDefault();
    });
  });

  /* ------------------------------------------------------------ from the watch to the alphabet */
  // a figure and a letter that took its move, on one step u: 0 the watch's
  // pixels, 1 the rule's outline (which Arris draws exactly at the watch's
  // weight, wght 600 and WTCH 100), 2 Arris at Regular with its optics;
  // data/transfer.json (tools/transfer.py) holds the pixels, the corners the
  // rule cuts and fills, and its outline, in font units on the site's font
  const tf = $('#tf');
  if (tf) fetch('data/transfer.json').then(r => r.json()).then(T => {
    const svg = $('#tf-svg'), range = $('#tf-u'), say = $('#tf-say'), also = $('#tf-also'), pairsEl = $('#tf-pairs'), steps = $$('.tf-ctl button', tf);
    const NS = 'http://www.w3.org/2000/svg', GAP = 240, INSET = 7;
    const SAY = [
      ['Pixels', 'the watch’s drawing: twelve rows, strokes two pixels thick.'],
      ['The rule', 'every exposed corner cut at 45°, every inside step filled on the same diagonal.'],
      ['Arris', 'the same drawing as strokes, free to take any weight.'],
    ];
    const AMBER = [255, 176, 0], CREAM = [241, 235, 221];
    const node = (tag, attrs, parent) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return parent.appendChild(e);
    };
    const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
    const smooth = t => t * t * (3 - 2 * t);
    let pair = 0, u = 0, parts = [], play = null, seen = false;

    T.pairs.forEach((P, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<b>${P.glyphs[0].ch} → ${P.glyphs[1].ch}</b><span>${P.move}</span>`;
      b.addEventListener('click', () => { pair = i; build(); if (seen) run(); });
      pairsEl.appendChild(b);
    });

    function build() {
      const P = T.pairs[pair];
      svg.textContent = '';
      parts = [];
      let x = 0, right = 0;
      P.glyphs.forEach(g => {
        const [bx, by, W, H, M] = g.box, grp = node('g', { transform: `translate(${x} 0)` }, svg);
        let grid = '', px = '';
        for (let c = 0; c <= W; c++) grid += `M${bx + c * M} ${by}V${by + H * M}`;
        for (let r = 0; r <= H; r++) grid += `M${bx} ${by + r * M}H${bx + W * M}`;
        g.rows.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === '#') px += `M${bx + c * M + INSET} ${by + r * M + INSET}h${M - 2 * INSET}v${M - 2 * INSET}h${2 * INSET - M}Z`;
        }));
        const p = {
          grid: node('path', { d: grid, class: 'tf-grid' }, grp),
          px: node('path', { d: px, class: 'tf-px' }, grp),
          rule: node('path', { d: g.rule, class: 'tf-rule' }, grp),
          fill: node('path', { d: g.fill, class: 'tf-fill' }, grp),
          cut: node('path', { d: g.cut, class: 'tf-cut' }, grp),
          text: node('text', { x: 0, y: 0, 'font-size': 1000, class: 'tf-text' }, grp),
        };
        p.text.textContent = g.ch;
        parts.push(p);
        right = x + bx + W * M;
        x += g.adv + GAP;
      });
      const [bx, by, , H, M] = P.glyphs[0].box;
      svg.setAttribute('viewBox', `${bx - 30} ${by - 30} ${right - bx + 60} ${H * M + 60}`);
      svg.setAttribute('aria-label', `${P.glyphs[0].ch} and ${P.glyphs[1].ch}, ${P.move}: from the watch's pixels to Arris`);
      also.textContent = P.where;
      $$('button', pairsEl).forEach((b, i) => b.setAttribute('aria-pressed', i === pair));
      draw();
    }

    function draw() {
      const k = smooth(ramp(u, 1, 2)), stop = u < 0.5 ? 0 : u < 1.5 ? 1 : 2;
      const col = `rgb(${AMBER.map((a, i) => Math.round(a + (CREAM[i] - a) * k)).join(',')})`;
      parts.forEach(p => {
        p.grid.style.opacity = 1 - 0.7 * ramp(u, 1, 1.6);
        p.px.style.opacity = (1 - 0.82 * ramp(u, 0.3, 0.9)) * (1 - ramp(u, 0.9, 1.05));
        p.cut.style.opacity = ramp(u, 0.1, 0.35) * (1 - ramp(u, 0.6, 0.9));
        p.cut.style.transform = `translate(0px, ${(50 * ramp(u, 0.6, 0.9)).toFixed(1)}px)`;   // knocked off
        p.fill.style.opacity = ramp(u, 0.3, 0.55) * (1 - ramp(u, 0.85, 1));
        p.rule.style.opacity = ramp(u, 0.55, 1) * (1 - ramp(u, 1.08, 1.22));   // under the font, which comes in first
        p.text.style.opacity = ramp(u, 1, 1.08);
        p.text.style.fontVariationSettings = fvs(600 - 200 * k, 0, 100 - 100 * k);
        p.text.style.fill = col;
      });
      range.value = Math.round(u * 100);
      steps.forEach((b, i) => b.setAttribute('aria-pressed', i === stop));
      const note = stop === 2 && T.pairs[pair].note ? ' ' + T.pairs[pair].note : '';
      say.innerHTML = `<b>${SAY[stop][0]}:</b> ${SAY[stop][1]}${note}`;
    }

    // a run: the pixels, the rule, then Arris, with a beat at each
    function run(frames = [[0, 0], [700, 0], [3000, 1], [4100, 1], [5700, 2]]) {
      if (reduce) { u = frames[frames.length - 1][1]; draw(); return; }
      const t0 = performance.now(), id = {};
      play = id;
      (function step(t) {
        if (play !== id) return;
        const e = t - t0;
        let i = 1;
        while (i < frames.length - 1 && e > frames[i][0]) i++;
        const [ta, ua] = frames[i - 1], [tb, ub] = frames[i];
        u = ua + (ub - ua) * smooth(ramp(e, ta, tb));
        draw();
        if (e < frames[frames.length - 1][0]) requestAnimationFrame(step); else play = null;
      })(t0);
    }
    steps.forEach(b => b.addEventListener('click', () => run([[0, u], [Math.max(250, 700 * Math.abs(+b.dataset.u - u)), +b.dataset.u]])));
    range.addEventListener('input', () => { play = null; u = range.value / 100; draw(); });
    // it runs from the pixels whenever its tab opens (and if it opened
    // while this was still loading, now)
    const open = () => { seen = true; if (!reduce) run(); };
    tf.addEventListener('show', open);
    build();
    if (!tf.closest('[hidden]')) open();
  });

  // the nine weights, upright
  const uw = $('#up-weights');
  for (let w = 100; w <= 900; w += 100) {
    const row = document.createElement('div');
    row.className = 'it-wrow';
    row.innerHTML = '<span class="it-wlabel"><i></i></span><span class="it-wtext">Survey ship back four days early</span>';
    row.querySelector('i').style.background = TI[w / 100 - 1];
    row.querySelector('.it-wlabel').append(`${w} ${NAMES[w]}`);
    row.querySelector('.it-wtext').style.fontVariationSettings = fvs(w, 0, 0);
    uw.appendChild(row);
  }

  /* ------------------------------------------------------------ the designspace */
  const map = $('#ds-map'), cells = $('#ds-cells'), cross = $('#ds-cross'), third = $('#ds-third');
  const dsText = $('#ds-text'), dsGhost = $('#ds-ghost'), dsStage = $('#ds-stage');
  const NX = 7, NY = 5;
  let pair = ['wght', 'WTCH'];
  const thirdAxis = () => Object.keys(AX).find(a => !pair.includes(a));
  const norm = (a, v) => (v - AX[a][0]) / (AX[a][1] - AX[a][0]);
  const denorm = (a, u) => AX[a][0] + clamp(u, 0, 1) * (AX[a][1] - AX[a][0]);
  const signed = (a, v) => (a === 'GRAD' && v > 0 ? '+' : '') + Math.round(v);

  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const c = document.createElement('span');
    c.textContent = 'a'; c.dataset.i = i; c.dataset.j = j;
    cells.appendChild(c);
  }
  let cellKey = '';
  function drawCells() {
    const t = thirdAxis(), key = pair.join() + Math.round(LOC[t]) + LOC.ital;
    if (key === cellKey) return;
    cellKey = key;
    for (const c of cells.children) {
      const l = { [pair[0]]: denorm(pair[0], c.dataset.i / (NX - 1)), [pair[1]]: denorm(pair[1], c.dataset.j / (NY - 1)), [t]: LOC[t] };
      c.style.fontVariationSettings = fvs(l.wght, l.GRAD, l.WTCH);
      c.style.color = titanium(l.wght);
      c.style.fontStyle = LOC.ital ? 'italic' : 'normal';
    }
  }
  function renderDS() {
    const t = thirdAxis();
    drawCells();
    cross.style.setProperty('--x', norm(pair[0], LOC[pair[0]]));
    cross.style.setProperty('--y', norm(pair[1], LOC[pair[1]]));
    third.style.setProperty('--u', norm(t, LOC[t]));
    third.querySelector('span').textContent = `${t} ${signed(t, LOC[t])}`;
    map.setAttribute('aria-valuetext', `weight ${Math.round(LOC.wght)}, grade ${Math.round(LOC.GRAD)}, watch ${Math.round(LOC.WTCH)}`);
    const v = fvs(LOC.wght, LOC.GRAD, LOC.WTCH);
    dsText.style.fontVariationSettings = v;
    dsText.style.color = titanium(LOC.wght);
    dsText.style.fontStyle = dsGhost.style.fontStyle = LOC.ital ? 'italic' : 'normal';
    dsGhost.style.fontVariationSettings = fvs(LOC.wght, 0, LOC.WTCH);
    dsStage.classList.toggle('graded', Math.round(LOC.GRAD) !== 0);
    for (const a in AX) {
      const s = $('#s-' + a);
      if (+s.value !== Math.round(LOC[a])) s.value = Math.round(LOC[a]);
      $('#o-' + a).textContent = a === 'wght' && NAMES[Math.round(LOC.wght)] ? `${Math.round(LOC.wght)} ${NAMES[Math.round(LOC.wght)]}` : signed(a, LOC[a]);
    }
    $('#s-wght').style.accentColor = titanium(LOC.wght);
    pressSwitch($('#ds-it'), $('#ds-up'), LOC.ital);
    $('#ds-css').textContent = `font-variation-settings: ${v};${LOC.ital ? ' font-style: italic;' : ''}`;
    $$('#ds-presets button').forEach(b => {
      const p = PRESETS[b.dataset.i][1];
      b.setAttribute('aria-pressed', Object.keys(p).every(k => Math.round(LOC[k]) === p[k]));
    });
  }
  subs.push(renderDS);

  // moving: the map, the keyboard, the wheel, the sliders, the presets, the fly-through
  let flying = false, tween = null;
  const stop = () => { flying = false; tween = null; $('#ds-fly').setAttribute('aria-pressed', false); $('#ds-fly').textContent = '▶ Fly through'; };
  function fromPointer(e) {
    const r = map.getBoundingClientRect();
    setLoc({ [pair[0]]: denorm(pair[0], (e.clientX - r.left) / r.width), [pair[1]]: denorm(pair[1], (e.clientY - r.top) / r.height) });
  }
  map.addEventListener('pointerdown', e => { stop(); map.setPointerCapture(e.pointerId); fromPointer(e); });
  map.addEventListener('pointermove', e => { if (map.hasPointerCapture(e.pointerId)) fromPointer(e); });
  map.addEventListener('wheel', e => {
    e.preventDefault(); stop();
    const t = thirdAxis(), span = AX[t][1] - AX[t][0];
    setLoc({ [t]: LOC[t] - Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 60) / 600 * span });
  }, { passive: false });
  map.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.1 : 0.02, t = thirdAxis();
    const mv = { ArrowLeft: [pair[0], -step], ArrowRight: [pair[0], step], ArrowUp: [pair[1], -step], ArrowDown: [pair[1], step], PageUp: [t, 0.05], PageDown: [t, -0.05] }[e.key];
    if (!mv) return;
    e.preventDefault(); stop();
    setLoc({ [mv[0]]: LOC[mv[0]] + mv[1] * (AX[mv[0]][1] - AX[mv[0]][0]) });
  });
  for (const a in AX) $('#s-' + a).addEventListener('input', e => { stop(); setLoc({ [a]: +e.target.value }); });
  $$('.ds-pairs button').forEach(b => b.addEventListener('click', () => {
    pair = b.dataset.pair.split(',');
    $$('.ds-pairs button').forEach(o => o.setAttribute('aria-pressed', o === b));
    $('#ds-xlabel').textContent = `${pair[0]} →`; $('#ds-ylabel').textContent = `${pair[1]} ↓`;
    cellKey = ''; renderDS();
  }));
  $('#ds-up').addEventListener('click', () => setLoc({ ital: false }));
  $('#ds-it').addEventListener('click', () => setLoc({ ital: true }));
  dsText.addEventListener('input', () => { dsGhost.textContent = dsText.textContent; });

  const PRESETS = [
    ['Thin', { wght: 100, GRAD: 0, WTCH: 0 }], ['Regular', { wght: 400, GRAD: 0, WTCH: 0 }], ['Bold', { wght: 700, GRAD: 0, WTCH: 0 }],
    ['Black', { wght: 900, GRAD: 0, WTCH: 0 }], ['The watch', { wght: 600, GRAD: 0, WTCH: 100 }],
    ['Light on dark', { wght: 400, GRAD: -50, WTCH: 0 }], ['Glance at night', { wght: 400, GRAD: -100, WTCH: 0 }],
    ['The far corner', { wght: 900, GRAD: 100, WTCH: 100 }],
  ];
  PRESETS.forEach(([name], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.i = i; b.textContent = name;
    b.addEventListener('click', () => glide(PRESETS[i][1]));
    $('#ds-presets').appendChild(b);
  });
  function glide(to) {
    stop();
    if (reduce) { setLoc(to); return; }
    const from = { wght: LOC.wght, GRAD: LOC.GRAD, WTCH: LOC.WTCH }, t0 = performance.now(), me = tween = {};
    (function step(t) {
      if (tween !== me) return;
      const u = clamp((t - t0) / 700, 0, 1), e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      setLoc(Object.fromEntries(Object.keys(to).map(k => [k, from[k] + (to[k] - from[k]) * e])));
      if (u < 1) requestAnimationFrame(step);
    })(t0);
  }
  // the fly-through follows the Lorenz attractor (sigma 10, rho 28, beta 8/3):
  // x is weight, y grade, z the watch (upward on the map, so the butterfly
  // stands the right way up), drawing its trail on the map.
  const trailEl = $('#ds-trail'), tctx = trailEl.getContext('2d');
  let trail = [];
  const L = { x: 19.5, y: 27, z: 48 };
  const toLoc = ([x, y, z]) => ({ wght: 500 + 400 * clamp(x / L.x, -1, 1), GRAD: 100 * clamp(y / L.y, -1, 1), WTCH: 100 * clamp(1 - z / L.z, 0, 1) });
  const lorenz = ([x, y, z]) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  function rk4(p, h) {
    const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
    const k1 = lorenz(p), k2 = lorenz(add(p, k1, h / 2)), k3 = lorenz(add(p, k2, h / 2)), k4 = lorenz(add(p, k3, h));
    return p.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  function drawTrail() {
    const dpr = devicePixelRatio || 1, W = trailEl.clientWidth, H = trailEl.clientHeight;
    if (trailEl.width !== Math.round(W * dpr)) { trailEl.width = Math.round(W * dpr); trailEl.height = Math.round(H * dpr); }
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, W, H);
    if (trail.length < 2) return;
    const px = l => (norm(pair[0], l[pair[0]]) * (NX - 1) + 0.5) / NX * W, py = l => (norm(pair[1], l[pair[1]]) * (NY - 1) + 0.5) / NY * H;
    tctx.lineWidth = 1.8; tctx.lineJoin = 'round';
    const bands = 24, n = trail.length;
    for (let b = 0; b < bands; b++) {
      const i0 = Math.floor(b * n / bands), i1 = Math.min(n - 1, Math.floor((b + 1) * n / bands) + 1);
      tctx.strokeStyle = `rgba(255,176,0,${(0.14 + 0.8 * (b + 1) / bands).toFixed(3)})`;
      tctx.beginPath(); tctx.moveTo(px(trail[i0]), py(trail[i0]));
      for (let i = i0 + 1; i <= i1; i++) tctx.lineTo(px(trail[i]), py(trail[i]));
      tctx.stroke();
    }
  }
  subs.push(drawTrail);
  addEventListener('resize', drawTrail);
  map.addEventListener('pointerdown', () => { if (!flying) { trail = []; drawTrail(); } });
  // a point already on the attractor (from (1, 1, 1) after 25 units of
  // time); a flight glides there first, then picks up where the last left off
  let onAttractor = [1, 1, 1];
  for (let i = 0; i < 6250; i++) onAttractor = rk4(onAttractor, 0.004);
  $('#ds-fly').addEventListener('click', e => {
    if (flying) { stop(); return; }
    const btn = e.currentTarget;
    trail = []; drawTrail();
    glide(toLoc(onAttractor));
    setTimeout(() => {
      tween = null; flying = true;
      btn.setAttribute('aria-pressed', true); btn.textContent = '■ Stop';
      let last = performance.now();
      const H = 0.004, RATE = 0.42;           // attractor time per second
      (function fly(t) {
        if (!flying) return;
        const steps = Math.max(1, Math.round(RATE * Math.min(0.05, (t - last) / 1000) / H)); last = t;
        for (let i = 0; i < steps; i++) onAttractor = rk4(onAttractor, H);
        const l = toLoc(onAttractor);
        trail.push(l); if (trail.length > 1500) trail.shift();
        setLoc(l);
        requestAnimationFrame(fly);
      })(last);
    }, reduce ? 0 : 720);
  });
  $('#ds-copy').addEventListener('click', e => copy($('#ds-css').textContent, e.currentTarget, 'Copy'));

  /* ------------------------------------------------------------ the italic */
  const PAIRS = 'aefgksy';
  const pairs = $('#it-pairs');
  [...PAIRS].forEach(ch => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'it-pair';
    b.setAttribute('aria-label', `${ch}, upright and italic`);
    b.innerHTML = '<span class="it-up"></span><span class="it-it"><span class="it-g"></span><span class="it-over" aria-hidden="true"></span></span>';
    b.querySelector('.it-up').textContent = ch; b.querySelector('.it-g').textContent = ch; b.querySelector('.it-over').textContent = ch;
    b.addEventListener('click', () => b.classList.toggle('show'));
    pairs.appendChild(b);
  });

  // the wave: each letter's weight follows the pointer (or drifts by itself);
  // a time is one piece, since its colon becomes the time colon (calt) only
  // when it is shaped with its figures, and letters of differing weights
  // are shaped apart
  const wave = $('#it-wave'), waveText = wave.textContent;
  let letters = [], centres = [];
  function layoutWave() {
    const words = waveText.split(' '), size = parseFloat(getComputedStyle(wave).fontSize);
    const per = Math.max(14, Math.floor(wave.clientWidth / (size * 0.6)));
    const lines = [];
    for (const w of words) {
      if (lines.length && (lines[lines.length - 1] + ' ' + w).length <= per) lines[lines.length - 1] += ' ' + w;
      else lines.push(w);
    }
    wave.textContent = '';
    lines.forEach((ln, i) => {
      const line = document.createElement('span');
      line.className = 'it-line';
      ln.match(/\d+:\d+|./gu).forEach(ch => { const s = document.createElement('span'); s.textContent = ch; line.appendChild(s); });
      wave.appendChild(line);
    });
    letters = $$('.it-line span', wave);
    letters.forEach(s => { s.style.fontVariationSettings = fvs(300, 0, 0); });
    centres = letters.map(s => { const r = s.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const r0 = wave.getBoundingClientRect();
    centres = centres.map(([x, y]) => [x - r0.left, y - r0.top]);
  }
  function waveAt(px, py) {
    letters.forEach((s, i) => {
      const dx = (centres[i][0] - px) / 110, dy = (centres[i][1] - py) / 70;
      const w = 250 + 650 * Math.exp(-(dx * dx + dy * dy));
      s.style.fontVariationSettings = fvs(w, 0, 0);
      s.style.color = w > 520 ? titanium(w) : '';
    });
  }
  let waveLive = false, waveTouched = false, waveSeen = false;
  wave.addEventListener('pointermove', e => { waveTouched = true; const r = wave.getBoundingClientRect(); waveAt(e.clientX - r.left, e.clientY - r.top); });
  wave.addEventListener('pointerleave', () => { waveTouched = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { waveSeen = es[0].isIntersecting; }).observe(wave);
  function drift(t) {
    if (!reduce && waveSeen && !waveTouched && letters.length) {
      const s = t / 1000, W = wave.clientWidth, H = wave.clientHeight;
      waveAt(W * (0.5 + 0.48 * Math.sin(s * 0.45)), H * (0.5 + 0.45 * Math.sin(s * 0.9)));
    }
    requestAnimationFrame(drift);
  }
  document.fonts.ready.then(() => { layoutWave(); waveLive = true; requestAnimationFrame(drift); });
  let rsz; addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (waveLive) layoutWave(); }, 200); });

  // the nine weights, in italic
  const iw = $('#it-weights');
  for (let w = 100; w <= 900; w += 100) {
    const row = document.createElement('div');
    row.className = 'it-wrow';
    row.innerHTML = '<span class="it-wlabel"><i></i></span><span class="it-wtext">Neon rain over Sector 7</span>';
    row.querySelector('i').style.background = TI[w / 100 - 1];
    row.querySelector('.it-wlabel').append(`${w} ${NAMES[w]}`);
    row.querySelector('.it-wtext').style.fontVariationSettings = fvs(w, 0, 0);
    iw.appendChild(row);
  }

  /* ------------------------------------------------------------ films: play in view */
  const vids = $$('video:not([data-scrub])');   // a scrubbed film follows the scroll instead (belt.js)
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.preload = 'auto'; e.target.play().catch(() => {}); } else e.target.pause();
    }), { threshold: 0.35 });
    vids.forEach(v => io.observe(v));
  }
  vids.forEach(v => v.addEventListener('click', () => (v.paused ? v.play() : v.pause())));

  /* ------------------------------------------------------------ the font's own facts */
  let FONT = null;
  fetch('data/font.json').then(r => r.json()).then(f => {
    FONT = f;
    $$('[data-font=version]').forEach(el => { el.textContent = f.version; });
    $$('[data-font=chars]').forEach(el => { el.textContent = f.chars.length.toLocaleString('en-US'); });
    buildSpecimen(f.chars);
  }).catch(() => buildSpecimen([...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'].map(ch => [ch.codePointAt(0), '', 'Basic Latin'])));

  /* ------------------------------------------------------------ specimen */
  // groups by what a reader would look for: ASCII digits and punctuation
  // join their own groups rather than leading the Latin
  function groupOf([cp, , block]) {
    const ch = String.fromCodePoint(cp);
    if (block === 'Basic Latin' || (block === 'Latin' && cp < 0x100)) {
      if (/\p{L}/u.test(ch)) return 'Latin';
      if (/\p{N}/u.test(ch) || /\p{Sc}/u.test(ch)) return 'Figures';
      if (/\p{Sm}/u.test(ch)) return 'Maths';
      return 'Punctuation';
    }
    return { Latin: 'Latin', Marks: 'Latin', Cyrillic: 'Cyrillic', Greek: 'Greek', Figures: 'Figures', Currency: 'Figures', Letterlike: 'Figures',
      Punctuation: 'Punctuation', Arrows: 'Arrows', Mathematics: 'Maths', Technical: 'Maths', Shapes: 'Shapes', Dingbats: 'Shapes',
      Terminal: 'Terminal', Braille: 'Braille' }[block] || 'Shapes';
  }
  // within a group, the everyday alphabet first, then the rest by code point
  function rank(cp, g) {
    if (g === 'Latin') return cp < 0x80 ? 0 : cp < 0x100 ? 1 : /\p{M}/u.test(String.fromCodePoint(cp)) ? 3 : 2;
    if (g === 'Cyrillic') return cp >= 0x410 && cp <= 0x44F ? 0 : cp === 0x401 || cp === 0x451 ? 0 : cp < 0x460 ? 1 : 2;
    if (g === 'Greek') return (cp >= 0x391 && cp <= 0x3A9) || (cp >= 0x3B1 && cp <= 0x3C9) ? 0 : cp < 0x400 ? 1 : 2;
    if (g === 'Figures') return cp >= 0x30 && cp <= 0x39 ? 0 : 1;
    return 0;
  }
  // Ё and ё sit with their alphabet, after Е and е
  const key = cp => (cp === 0x401 ? 0x415 + 0.5 : cp === 0x451 ? 0x435 + 0.5 : cp);
  const ORDER = ['Latin', 'Cyrillic', 'Greek', 'Figures', 'Punctuation', 'Arrows', 'Maths', 'Shapes', 'Terminal', 'Braille'];
  const groups = {};
  let group = null, sel = 0x41, card = { ital: false };
  const show = cp => { const ch = String.fromCodePoint(cp); return /\p{M}/u.test(ch) ? '◌' + ch : ch; };
  const byCp = new Map();

  function buildSpecimen(chars) {
    chars.forEach(c => {
      byCp.set(c[0], c);
      if (c[0] <= 0x20 || c[0] === 0xA0 || /\p{Cf}|\p{Zs}/u.test(String.fromCodePoint(c[0]))) return;
      const g = groupOf(c);
      (groups[g] = groups[g] || []).push(c[0]);
    });
    for (const g in groups) groups[g].sort((a, b) => rank(a, g) - rank(b, g) || key(a) - key(b));
    const bar = $('#groups');
    ORDER.filter(g => groups[g]).forEach(g => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.group = g;
      b.innerHTML = `${g}<small>${groups[g].length}</small>`;
      b.addEventListener('click', () => openGroup(g));
      bar.appendChild(b);
    });
    openGroup('Latin');
  }

  let opening = 0;
  async function openGroup(g) {
    const me = ++opening, list = groups[g], grid = $('#grid');
    group = g;
    $$('#groups button').forEach(b => b.setAttribute('aria-selected', b.dataset.group === g));
    // the full font loads on first use; show the set only once its glyphs are here
    const sample = list.slice(0, 40).map(show).join('');
    if (!document.fonts.check('400 24px Arris', sample)) {
      grid.innerHTML = `<p class="grid-wait">Loading ${g}…</p>`;
      try { await document.fonts.load('400 24px Arris', sample); } catch (e) { /* draw with what is there */ }
      if (me !== opening) return;
    }
    grid.textContent = '';
    const frag = document.createDocumentFragment();
    list.forEach(cp => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.cp = cp;
      b.textContent = show(cp);
      b.title = `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${byCp.get(cp)[1]}`;
      frag.appendChild(b);
    });
    grid.appendChild(frag);
    grid.scrollTop = 0;
    select(list.includes(sel) ? sel : list[0]);
  }

  $('#grid').addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(+b.dataset.cp); });
  $('#grid').addEventListener('keydown', e => {
    const keys = { ArrowRight: 1, ArrowLeft: -1 }, bs = $$('#grid button');
    if (!bs.length) return;
    const cols = Math.round($('#grid').clientWidth / bs[0].clientWidth) || 1;
    keys.ArrowDown = cols; keys.ArrowUp = -cols;
    if (!(e.key in keys)) return;
    e.preventDefault();
    const i = bs.indexOf(document.activeElement), n = bs[clamp(i + keys[e.key], 0, bs.length - 1)];
    n.focus(); select(+n.dataset.cp);
  });

  function select(cp) {
    sel = cp;
    $$('#grid button').forEach(b => b.setAttribute('aria-selected', +b.dataset.cp === cp));
    const c = byCp.get(cp) || [cp, '', ''];
    $('#card-cp').textContent = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
    $('#card-block').textContent = group || c[2];
    $('#card-name').textContent = c[1];
    $('#card-ch').textContent = show(cp);
    drawCard();
  }

  // the card: live text on the font's metrics, at a place of its own (CL),
  // set by the triangle under it
  const stage = $('#card-stage'), glyph = $('#card-glyph'), chEl = $('#card-ch'), linesEl = $('#card-lines');
  const CL = { wght: 400, GRAD: 0, WTCH: 0, ital: false };
  const METRICS = [['ASCENDER', 'ascender'], ['CAP HEIGHT', 'cap'], ['X-HEIGHT', 'x'], ['BASELINE', null], ['DESCENDER', 'descender']];
  function layoutCard() {
    const M = FONT ? FONT.metrics : { upm: 1000, ascender: 975, descender: -250, cap: 720, x: 540 };
    const H = stage.clientHeight, S = H * 0.66 / ((M.ascender - M.descender) / M.upm), top = (H - S * (M.ascender - M.descender) / M.upm) / 2;
    glyph.style.fontSize = S + 'px';
    glyph.style.top = top + 'px';
    glyph.style.lineHeight = (M.ascender - M.descender) / M.upm;
    linesEl.innerHTML = METRICS.map(([n, k]) => {
      const v = k ? M[k] : 0, y = top + (M.ascender - v) / M.upm * S;
      return `<div class="${k ? '' : 'base'}" style="top:${y.toFixed(1)}px"><span>${n} ${v}</span></div>`;
    }).join('');
    return { M, S };
  }
  let cardM = null;
  function drawCard() {
    if (!cardM) cardM = layoutCard();
    glyph.style.fontVariationSettings = fvs(CL.wght, CL.GRAD, CL.WTCH);
    glyph.style.fontStyle = CL.ital ? 'italic' : 'normal';
    pressSwitch($('#card-it'), $('#card-up'), CL.ital);
    const adv = Math.round(chEl.getBoundingClientRect().width / cardM.S * cardM.M.upm);
    $('#card-metrics').innerHTML = `<span>ADVANCE ${adv}</span><span>wght ${Math.round(CL.wght)}</span><span>GRAD ${signed('GRAD', CL.GRAD)}</span><span>WTCH ${Math.round(CL.WTCH)}</span>`;
    drawTri();
  }
  addEventListener('resize', () => { cardM = layoutCard(); drawCard(); });
  $('#card-up').addEventListener('click', () => { CL.ital = false; drawCard(); });
  $('#card-it').addEventListener('click', () => {
    CL.ital = true; drawCard();
    document.fonts.load('italic 400 24px Arris', chEl.textContent).then(drawCard);
  });

  // The triangle: each axis runs along a median, from the middle of the
  // opposite edge (t = 0) to its vertex (t = 1). The axes do not end alike,
  // so each is placed by its default: the centroid (t = 1/3) is Regular,
  // wght 400, GRAD 0 and WTCH 0 at once, and the three handles meet there.
  // Weight and grade run on below it, to Thin and to -100; the watch starts
  // there. The shape the handles draw is the place's signature.
  const TRI = {
    wght: { v: [120, 14], to: v => v <= 400 ? (v - 100) / 900 : 1 / 3 + (v - 400) / 750, from: t => t <= 1 / 3 ? 100 + t * 900 : 400 + (t - 1 / 3) * 750, lo: 0, label: 'wght 900' },
    GRAD: { v: [16, 194], to: v => v <= 0 ? (v + 100) / 300 : 1 / 3 + v / 150, from: t => t <= 1 / 3 ? -100 + t * 300 : (t - 1 / 3) * 150, lo: 0, label: 'GRAD +100' },
    WTCH: { v: [224, 194], to: v => 1 / 3 + v / 150, from: t => (t - 1 / 3) * 150, lo: 1 / 3, label: 'WTCH 100' },
  };
  const AXES = ['wght', 'GRAD', 'WTCH'];
  AXES.forEach(a => { const [o1, o2] = AXES.filter(b => b !== a).map(b => TRI[b].v); TRI[a].m = [(o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2]; });
  const at = (a, t) => [TRI[a].m[0] + t * (TRI[a].v[0] - TRI[a].m[0]), TRI[a].m[1] + t * (TRI[a].v[1] - TRI[a].m[1])];
  const tri = $('#tri'), NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent = tri) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  el('polygon', { points: AXES.map(a => TRI[a].v.join(',')).join(' '), class: 'tri-edge' });
  AXES.forEach(a => {
    el('line', { x1: TRI[a].m[0], y1: TRI[a].m[1], x2: TRI[a].v[0], y2: TRI[a].v[1], class: 'tri-median' });
    const [lx, ly, anchor] = a === 'wght' ? [TRI[a].v[0] - 14, TRI[a].v[1] + 4, 'end'] : [TRI[a].v[0] + (a === 'GRAD' ? -6 : 6), TRI[a].v[1] + 15, a === 'GRAD' ? 'start' : 'end'];
    el('text', { x: lx, y: ly, class: 'tri-label', 'text-anchor': anchor }).textContent = TRI[a].label;
  });
  const shape = el('polygon', { class: 'tri-shape' });
  const handles = {};
  AXES.forEach(a => {
    const h = el('g', { class: 'tri-handle', tabindex: 0, role: 'slider', 'aria-label': { wght: 'Weight', GRAD: 'Grade', WTCH: 'Watch' }[a],
      'aria-valuemin': AX[a][0], 'aria-valuemax': AX[a][1] });
    el('polygon', { points: '-3.3,-8 3.3,-8 8,-3.3 8,3.3 3.3,8 -3.3,8 -8,3.3 -8,-3.3' }, h);
    handles[a] = h;
    h.addEventListener('keydown', e => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
      if (!d) return;
      e.preventDefault();
      CL[a] = clamp(Math.round(CL[a] + d * (a === 'wght' ? 10 : 2)), AX[a][0], AX[a][1]); drawCard();
    });
  });
  function drawTri() {
    const pts = AXES.map(a => at(a, TRI[a].to(CL[a])));
    shape.setAttribute('points', pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' '));
    AXES.forEach((a, i) => {
      handles[a].setAttribute('transform', `translate(${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)})`);
      handles[a].setAttribute('aria-valuenow', Math.round(CL[a]));
    });
  }
  // drag a handle along its median; a press elsewhere takes the nearest
  // median's handle. Where handles sit together (all three at Regular), the
  // press waits for the drag's first few pixels and takes the axis whose
  // median runs most nearly that way.
  let dragging = null, pending = null;
  function svgPoint(e) { const r = tri.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 240, (e.clientY - r.top) / r.height * 214]; }
  function tOn(a, p) {
    const m = TRI[a].m, v = TRI[a].v, dx = v[0] - m[0], dy = v[1] - m[1];
    return clamp(((p[0] - m[0]) * dx + (p[1] - m[1]) * dy) / (dx * dx + dy * dy), TRI[a].lo, 1);
  }
  function moveTo(a, p) { CL[a] = clamp(TRI[a].from(tOn(a, p)), AX[a][0], AX[a][1]); drawCard(); }
  function take(a, p) { dragging = a; pending = null; handles[a].focus({ preventScroll: true }); moveTo(a, p); }
  tri.addEventListener('pointerdown', e => {
    const p = svgPoint(e);
    tri.setPointerCapture(e.pointerId);
    const near = AXES.filter(a => { const q = at(a, TRI[a].to(CL[a])); return Math.hypot(q[0] - p[0], q[1] - p[1]) < 11; });
    if (near.length > 1) { pending = { p, axes: near }; return; }
    take(near[0] || AXES.map(a => { const q = at(a, tOn(a, p)); return [Math.hypot(q[0] - p[0], q[1] - p[1]), a]; })
      .sort((x, y) => x[0] - y[0])[0][1], p);
  });
  tri.addEventListener('pointermove', e => {
    if (!tri.hasPointerCapture(e.pointerId)) return;
    const p = svgPoint(e);
    if (pending) {
      const dx = p[0] - pending.p[0], dy = p[1] - pending.p[1], d = Math.hypot(dx, dy);
      if (d < 4) return;
      // the median most nearly along the drag; the watch only runs toward its vertex
      const best = pending.axes.map(a => {
        const mx = TRI[a].v[0] - TRI[a].m[0], my = TRI[a].v[1] - TRI[a].m[1], c = (dx * mx + dy * my) / (d * Math.hypot(mx, my));
        return [a === 'WTCH' && c < 0 && CL.WTCH <= 0 ? -1 : Math.abs(c), a];
      }).sort((x, y) => y[0] - x[0])[0][1];
      take(best, p);
      return;
    }
    if (dragging) moveTo(dragging, p);
  });
  tri.addEventListener('pointerup', () => { dragging = null; pending = null; });
  $('#tri-reset').addEventListener('click', () => { Object.assign(CL, { wght: 400, GRAD: 0, WTCH: 0 }); drawCard(); });

  /* ------------------------------------------------------------ corrections */
  // a heading corrected as it comes up the page (css .redline): --p runs
  // from 0, as it rises past nine tenths of the window, to 1 by its middle:
  // the strike over the first half, the word written in over the second.
  // With reduced motion it is corrected already
  $$('.redline').forEach(h => {
    if (reduce) { h.style.setProperty('--p', 1); return; }
    let queued = false;
    const set = () => {
      queued = false;
      const top = h.getBoundingClientRect().top, H = innerHeight;
      h.style.setProperty('--p', clamp((H * 0.9 - top) / (H * 0.4), 0, 1).toFixed(3));
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(set); } }, { passive: true });
    addEventListener('resize', set);
    set();
  });

  /* ------------------------------------------------------------ features */
  const FEATS = [
    ['calt', '10:08', 'Time colon between figures. On by default', true],
    ['ss20', '10:08', "Figures in the watch's pixels"],
    ['zero', '2001', 'Slashed zero'],
    ['ss01', '2001', 'Dotted zero'],
    ['ss02', '5 6 5', 'Open five, harder to mistake for a 6'],
    ['frac', '1/2 7/8', 'Fractions'],
    ['sups', 'x2 + y2', 'Superiors'],
    ['subs', 'H2O CO2', 'Inferiors'],
    ['case', '(A-Z) [HI]', 'Brackets and dashes raised for capitals'],
    ['pnum', '1110', 'Proportional figures. Tabular is the default'],
    ['cv01', 'aaa', 'Single-storey a'],
  ];
  const fl = $('#feat-list');
  FEATS.forEach(([tag, text, what, onByDefault]) => {
    const d = document.createElement('div');
    d.className = 'feat';
    d.innerHTML = '<code></code><span class="off"></span><span class="arrow">→</span><span class="on"></span><span class="what"></span>';
    d.querySelector('code').textContent = tag;
    d.querySelector('.off').style.fontFeatureSettings = onByDefault ? `"${tag}" 0` : 'normal';
    d.querySelector('.on').style.fontFeatureSettings = `"${tag}" 1`;
    d.querySelector('.off').textContent = text; d.querySelector('.what').textContent = what;
    d.querySelector('.on').textContent = text;
    fl.appendChild(d);
  });

  /* ------------------------------------------------------------ measured, not eyeballed */
  const mo = $('#m-open');
  [100, 500, 900].forEach(w => {
    const sp = document.createElement('span');
    sp.textContent = '4ae'; sp.title = `${w} ${NAMES[w]}`;
    sp.style.fontVariationSettings = fvs(w, 0, 0);
    mo.appendChild(sp);
  });
  // the vision model squints with a Gaussian 5% of the cap height (0.72 em)
  // wide; the slider's two-thirds mark is that, its end half again
  const sq = $('#m-squint span'), sqIn = $('#squint');
  const squint = () => {
    const em = parseFloat(getComputedStyle(sq).fontSize);
    sq.style.setProperty('--blur', (sqIn.value / 100 * 0.075 * 0.72 * em).toFixed(2) + 'px');
  };
  sqIn.addEventListener('input', squint); addEventListener('resize', squint); squint();

  // corrected, or the watch's own drawing (WTCH 100, pixel-exact: no
  // overshoot, no raised middle); numbers measured from the 1.002 release
  const mg = $('#m-grid');
  function corrected(on) {
    mg.style.setProperty('--mx', on ? 0 : 100);
    pressSwitch($('#m-on'), $('#m-off'), on);
    $('#m-over-num').textContent = on ? '+3 units' : 'on the line';
    $('#m-centre-num').textContent = on ? '+20 units' : 'on the middle';
    requestAnimationFrame(placeLens);
  }
  $('#m-on').addEventListener('click', () => corrected(true));
  $('#m-off').addEventListener('click', () => corrected(false));
  // the lens: the same two letters at MAG times the size, placed so that the
  // middle of S's top edge (half its advance in, on the cap line) is at its centre
  const lens = $('#lens'), lensIn = $('#lens-in'), MAG = 30;
  function placeLens() {
    const stage = $('#m-over'), sR = $('#m-s').getBoundingClientRect(), stR = stage.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(stage).fontSize), R = lens.clientWidth / 2;
    const fx = sR.left - stR.left + sR.width / 2, fy = 0.255 * fs;
    lensIn.style.fontSize = fs * MAG + 'px';
    lensIn.style.left = (R - fx * MAG) + 'px';
    lensIn.style.top = (R - fy * MAG) + 'px';
  }
  document.fonts.ready.then(placeLens); addEventListener('resize', placeLens);

  /* ------------------------------------------------------------ the arris */
  const crossing = $('#crossing'), sticky = $('.crossing-sticky');
  function onScroll() {
    const r = crossing.getBoundingClientRect();
    const p = reduce ? 0.5 : clamp(-r.top / (r.height - innerHeight), 0, 1);
    sticky.style.setProperty('--p', p.toFixed(4));
    sticky.style.setProperty('--o', Math.max(0, 1 - Math.abs(p - 0.5) * 2.6).toFixed(3));
    document.body.classList.toggle('past', r.top + r.height * 0.45 < 0);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ------------------------------------------------------------ the survey */
  // the four named minerals make 85.8 %; the total says so, until the
  // fifth row shows and it reads 100.0
  const slice = $('#slice'), leakRow = $('.leak-row'), survey = $('.survey'), totalEl = $('#survey-total');
  function leaking(on) {
    leakRow.classList.toggle('on', on);
    survey.classList.toggle('leaking', on);
    totalEl.textContent = on ? '100.0' : '85.8';
  }
  // a mouse shows it while over the row; a tap shows it for a moment, then
  // the slices take it back (a touch screen's hover stays after the tap, so
  // it is not asked)
  let hovering = false, hold = 0;
  const cycling = !reduce && slice;
  leakRow.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; leaking(true); } });
  leakRow.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hovering = false; leaking(false); } });
  leakRow.addEventListener('click', () => {
    if (hovering) return;
    if (cycling) { leaking(true); hold = 10; } else leaking(!leakRow.classList.contains('on'));
  });
  if (cycling) {
    let s = 1;
    setInterval(() => {
      if (hold > 0) { hold--; return; }
      s = s % 33 + 1;
      slice.textContent = two(s);
      if (!hovering) leaking(s === 33);
      if (s === 33) hold = 8;
    }, 180);
  }

  /* ------------------------------------------------------------ copy */
  function copy(text, button, label) {
    navigator.clipboard.writeText(text).then(() => { button.textContent = 'Copied'; }, () => { button.textContent = 'Select and copy'; });
    setTimeout(() => { button.textContent = label; }, 2200);
  }
  $('#copy-css').addEventListener('click', e => copy($('#css-snippet').textContent, e.currentTarget, 'Copy CSS'));

  setLoc({});

  /* ------------------------------------------------------------ for whoever opens the console */
  console.log('%c┌──────────────────────────┐\n│ DOCK 07 · MANIFEST       │\n│ 0347 KAPA      14.2 %  ? │\n│ logged 03:47 · bay 09    │\n└──────────────────────────┘',
    'font-family: "Arris Mono", monospace; color: #3fd6ff; line-height: 1.2');
})();

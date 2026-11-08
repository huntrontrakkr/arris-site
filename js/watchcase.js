/* The watch the figures came from, drawn as a watch: a titanium case in the
 * octagon the font cuts its corners to, a bezel brushed along each of its
 * eight faces between two polished chamfers (each an arris, the edge the
 * font is named for), a dial sunk under the inner chamfer, a crown at three
 * o'clock with a thin ring anodized in the colour of the watch's weight
 * (the figures are drawn at 600), and the strap's two ends.
 *
 * The polished faces are lit as metal is: each a flat facet at 45 degrees,
 * bright when it turns the light toward the eye and dark when it does not,
 * so the light runs round the bezel as the light moves. The light follows
 * the pointer and the case leans a little toward it; on a touch screen the
 * page's scroll moves it, as a wrist turns. With reduced motion it rests,
 * lit from the upper left. The seconds fill a ring of sixty marks in amber,
 * the colour of what is live on this page. */
(() => {
  const watch = document.getElementById('watch');
  if (!watch) return;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  // the case, in units: a regular octagon 400 across the flats, its bezel
  // from the outer chamfer in to the dial
  const A = { case: 200, bezel: 189, top: 171, dial: 163, tickOut: 154, tickIn: 147, tickMajor: 141 };
  const oct = a => Array.from({ length: 8 }, (_, k) => {
    const t = (-22.5 + 45 * k) * Math.PI / 180, r = a / Math.cos(Math.PI / 8);
    return [r * Math.cos(t), r * Math.sin(t)];
  });
  const pts = ps => ps.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ');
  // facet k of the ring between apothems a (outer) and b (inner): its flat
  // faces the angle 45k (0 = right, 90 = down)
  const ring = (a, b) => {
    const o = oct(a), i = oct(b);
    return Array.from({ length: 8 }, (_, k) => [o[k], o[(k + 1) % 8], i[(k + 1) % 8], i[k]]);
  };
  // the distance from the centre to an octagon's edge along an angle
  const reach = (a, deg) => a / Math.cos((deg - 45 * Math.round(deg / 45)) * Math.PI / 180);

  const svg = el('svg', { class: 'watch-case', viewBox: '-250 -300 500 600', 'aria-hidden': 'true', focusable: 'false' });
  const defs = el('defs', {}, svg);

  // brushing: fine lines of uneven weight, one pattern for each direction a
  // bezel face runs (opposite faces run the same way)
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const brush = el('g', {});
  for (let y = 0; y < 24; y += 0.75) {
    const a = rnd();
    el('rect', { x: 0, y: y.toFixed(2), width: 240, height: (0.35 + rnd() * 0.5).toFixed(2),
      fill: a > 0.5 ? '#fff' : '#000', opacity: (0.04 + 0.1 * Math.abs(a - 0.5)).toFixed(3) }, brush);
  }
  for (const r of [0, 45, 90, 135]) {
    const p = el('pattern', { id: `wc-brush-${r}`, width: 240, height: 24, patternUnits: 'userSpaceOnUse', patternTransform: `rotate(${r})` }, defs);
    p.appendChild(brush.cloneNode(true));
  }
  // the strap's ends fade into the paper
  const fade = (id, y1, y2) => {
    const g = el('linearGradient', { id, x1: 0, y1, x2: 0, y2, gradientUnits: 'userSpaceOnUse' }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 }, g);
    el('stop', { offset: 0.45, 'stop-color': '#fff', 'stop-opacity': 1 }, g);
    el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, g);
    const m = el('mask', { id: id + '-m', maskUnits: 'userSpaceOnUse', x: -250, y: -300, width: 500, height: 600 }, defs);
    el('rect', { x: -250, y: -300, width: 500, height: 600, fill: `url(#${id})` }, m);
  };
  fade('wc-up', -170, -300);
  fade('wc-dn', 170, 300);
  // the crystal's reflection, a soft band across the dial
  const glare = el('linearGradient', { id: 'wc-glare', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  [[0, 0], [0.42, 0.07], [0.5, 0.1], [0.58, 0.07], [1, 0]].forEach(([o, a]) =>
    el('stop', { offset: o, 'stop-color': '#f3eee3', 'stop-opacity': a }, glare));
  const dialClip = el('clipPath', { id: 'wc-dial' }, defs);
  el('polygon', { points: pts(oct(A.dial)) }, dialClip);

  // the strap: two ends, charcoal, a channel down each
  for (const [dir, m] of [[-1, 'wc-up-m'], [1, 'wc-dn-m']]) {
    const g = el('g', { mask: `url(#${m})` }, svg);
    const w0 = 74, w1 = 66, y0 = dir * 150, y1 = dir * 300;
    el('polygon', { points: pts([[-w0, y0], [w0, y0], [w1, y1], [-w1, y1]]), fill: '#1c1e21' }, g);
    for (const x of [-w0 + 9, w0 - 9]) el('line', { x1: x, y1: y0, x2: x * w1 / w0, y2: y1, stroke: '#2b2e32', 'stroke-width': 1.4 }, g);
    for (let y = 214; y < 300; y += 13) el('line', { x1: -50, y1: dir * y, x2: 50, y2: dir * y, stroke: '#141618', 'stroke-width': 3 }, g);
  }

  // the crown at three o'clock: a tube, the anodized ring, the knurled crown
  const crown = el('g', {}, svg);
  el('rect', { x: 196, y: -11, width: 12, height: 22, fill: '#3a3d41' }, crown);
  el('rect', { x: 206, y: -19, width: 3.2, height: 38, fill: 'var(--t600, #f2cc61)' }, crown);
  const crownBody = el('polygon', { points: pts([[209, -24], [226, -24], [231, -19], [231, 19], [226, 24], [209, 24]]) }, crown);
  for (let x = 212; x < 230; x += 3.2) el('line', { x1: x, y1: -22, x2: x, y2: 22, stroke: '#000', 'stroke-opacity': 0.22, 'stroke-width': 1 }, crown);

  // the case's flank, seen below and beside the bezel as the case's depth
  const flank = el('polygon', { points: pts(oct(A.case + 0.5)), fill: '#4a4d51' }, svg);
  // the outer chamfer, the brushed bezel, the inner chamfer
  // each polished facet a gradient along its length: a flat mirror under a
  // near light shows the light's falloff across it
  const along = (id, f) => {
    const g = el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: f[0][0], y1: f[0][1], x2: f[1][0], y2: f[1][1] }, defs);
    return [el('stop', { offset: 0 }, g), el('stop', { offset: 1 }, g)];
  };
  const outerG = ring(A.case, A.bezel).map((f, k) => along(`wc-o${k}`, f));
  const outer = ring(A.case, A.bezel).map((f, k) => el('polygon', { points: pts(f), fill: `url(#wc-o${k})` }, svg));
  const top = ring(A.bezel, A.top).map(f => el('polygon', { points: pts(f) }, svg));
  ring(A.bezel, A.top).forEach((f, k) => el('polygon', { points: pts(f), fill: `url(#wc-brush-${(45 * k + 90) % 180})` }, svg));
  const innerG = ring(A.top, A.dial).map((f, k) => along(`wc-i${k}`, f));
  ring(A.top, A.dial).forEach((f, k) => el('polygon', { points: pts(f), fill: `url(#wc-i${k})` }, svg));
  // the arrises: hairlines where each chamfer meets the bezel's face
  const edgeOut = el('polygon', { points: pts(oct(A.bezel)), fill: 'none', 'stroke-width': 0.9 }, svg);
  const edgeIn = el('polygon', { points: pts(oct(A.top)), fill: 'none', 'stroke-width': 0.9 }, svg);

  // the dial, sunk a little: darker at its rim
  el('polygon', { points: pts(oct(A.dial)), fill: '#0c0e10' }, svg);
  el('polygon', { points: pts(oct(A.dial - 1.5)), fill: 'none', stroke: '#000', 'stroke-opacity': 0.7, 'stroke-width': 4 }, svg);
  // sixty marks for the seconds, every fifth longer
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const deg = -90 + 6 * i, rad = deg * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const r0 = reach(A.tickOut, deg), r1 = reach(i % 5 ? A.tickIn : A.tickMajor, deg);
    return el('line', { x1: (r0 * c).toFixed(2), y1: (r0 * s).toFixed(2), x2: (r1 * c).toFixed(2), y2: (r1 * s).toFixed(2),
      class: 'wc-tick' + (i % 5 ? '' : ' major') }, svg);
  });
  const glareBand = el('rect', { x: -260, y: -260, width: 260, height: 520, fill: 'url(#wc-glare)' },
    el('g', { 'clip-path': 'url(#wc-dial)' }, svg));

  const body = document.createElement('div');
  body.className = 'watch-body';
  const dial = document.createElement('div');
  dial.className = 'watch-dial';
  while (watch.firstChild) dial.appendChild(watch.firstChild);
  body.append(svg, dial);
  watch.appendChild(body);
  watch.classList.add('cased');

  // the light. Polished metal shows what it reflects: a chamfer at 45
  // degrees reflects the room beside it, in the direction its facet faces,
  // so it is bright where that direction meets the light (a softbox, wide)
  // and the fill opposite, and dark elsewhere. The brushed bezel scatters,
  // lit more evenly, brighter on the faces toward the light
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, Math.max(0, t))));
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const POL = [[52, 55, 59], [250, 248, 242]], BRU = [[112, 116, 120], [226, 227, 224]];
  const gap = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };
  function room(dir, sun, power) {
    const key = Math.exp(-Math.pow(gap(dir, sun) / 42, 2)), fill = Math.exp(-Math.pow(gap(dir, sun + 180) / 55, 2));
    const sky = 0.5 - 0.5 * Math.sin(dir * Math.PI / 180);           // facing up sees more of the room's light
    return 0.1 + 0.16 * sky + power * (0.95 * key + 0.22 * fill);
  }
  const REST = { x: -0.45, y: -0.75 };
  const cur = { ...REST }, aim = { ...REST };
  function paint() {
    const sun = Math.atan2(cur.y, cur.x) * 180 / Math.PI, power = Math.min(1, 0.45 + 0.6 * Math.hypot(cur.x, cur.y));
    for (let k = 0; k < 8; k++) {
      const a = 45 * k;
      // the outer chamfer faces out; along it, the reflection turns by the
      // facet's half-width as seen from the light
      outerG[k][0].setAttribute('stop-color', rgb(mix(...POL, room(a - 12, sun, power))));
      outerG[k][1].setAttribute('stop-color', rgb(mix(...POL, room(a + 12, sun, power))));
      // the inner chamfer faces in, and is half in the dial's shadow
      innerG[k][0].setAttribute('stop-color', rgb(mix(...POL, 0.12 + 0.75 * room(a + 180 - 12, sun, power))));
      innerG[k][1].setAttribute('stop-color', rgb(mix(...POL, 0.12 + 0.75 * room(a + 180 + 12, sun, power))));
      top[k].setAttribute('fill', rgb(mix(...BRU, 0.5 + 0.28 * power * Math.cos((a - sun) * Math.PI / 180) - 0.06 * Math.sin(a * Math.PI / 180))));
    }
    crownBody.setAttribute('fill', rgb(mix(...BRU, 0.55 + 0.3 * power * Math.cos(sun * Math.PI / 180))));
    const e = Math.max(0, Math.min(1, 0.35 + 0.5 * Math.hypot(cur.x, cur.y)));
    edgeOut.setAttribute('stroke', `rgba(255,253,247,${(0.25 + 0.5 * e).toFixed(2)})`);
    edgeIn.setAttribute('stroke', `rgba(255,253,247,${(0.15 + 0.35 * e).toFixed(2)})`);
    flank.setAttribute('transform', `translate(${(-cur.x * 4).toFixed(2)} ${(7 - cur.y * 3).toFixed(2)})`);
    glareBand.setAttribute('transform', `rotate(-28) translate(${(cur.x * 70 + 60).toFixed(1)} ${(cur.y * 30).toFixed(1)})`);
    body.style.setProperty('--wc-ry', `${(cur.x * 7).toFixed(2)}deg`);
    body.style.setProperty('--wc-rx', `${(-cur.y * 5).toFixed(2)}deg`);
    body.style.setProperty('--wc-sx', `${(-cur.x * 12).toFixed(1)}px`);
    body.style.setProperty('--wc-sy', `${(16 - cur.y * 8).toFixed(1)}px`);
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(hover: none)');
  let raf = 0, inView = false;
  function step() {
    raf = 0;
    cur.x += (aim.x - cur.x) * 0.12;
    cur.y += (aim.y - cur.y) * 0.12;
    paint();
    if (Math.abs(aim.x - cur.x) + Math.abs(aim.y - cur.y) > 0.002) raf = requestAnimationFrame(step);
  }
  const go = () => { if (!raf && inView && !still.matches) raf = requestAnimationFrame(step); };
  const clamp = v => Math.max(-1, Math.min(1, v));
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || touch.matches) return;
    const r = watch.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    aim.x = clamp((e.clientX - cx) / (innerWidth * 0.45));
    aim.y = clamp((e.clientY - cy) / (innerHeight * 0.45));
    go();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { Object.assign(aim, REST); go(); });
  // on a touch screen the scroll turns the wrist: the light runs down the
  // bezel as the watch rises through the screen
  function scrolled() {
    if (!touch.matches || !inView) return;
    const r = watch.getBoundingClientRect(), v = clamp((r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2));
    aim.x = -0.5 + 0.45 * v; aim.y = -0.15 - 0.7 * v;
    go();
  }
  addEventListener('scroll', scrolled, { passive: true });
  new IntersectionObserver(es => { inView = es[0].isIntersecting; scrolled(); go(); }).observe(watch);
  paint();

  // the seconds
  let shown = -1;
  setInterval(() => {
    const s = new Date().getSeconds();
    if (s === shown) return;
    shown = s;
    ticks.forEach((t, i) => t.classList.toggle('on', i <= s));
  }, 250);
})();

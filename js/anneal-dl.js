/* The download, annealed. The button is amber metal. Where the pointer
 * comes onto it (by keyboard, at its middle) a flame touches it, and one of
 * titanium's oxide colours spreads from there across the metal, its edge
 * uneven as a film grows, in under a second; it holds while the pointer is on
 * it and cools back to amber when it leaves. Each visit is the next colour,
 * through the light half of the sequence so the night ink on it stays
 * readable: gold, rose, violet, sky, teal, and round again. On a phone it
 * anneals once, the first time it is seen, and cools back. A faint grain runs
 * along the metal. With reduced motion the button stays amber. */
(() => {
  const btn = document.querySelector('.dl-button');
  if (!btn || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const STAGES = ['#ffb000', '#f2cc61', '#e67891', '#9e66d1', '#a8cced', '#45c7a8'];
  const CELL = 2;        // css px a cell (the canvas is drawn smoothed up to the button)
  const TIME = 0.8;      // seconds for the colour to cross the button from where it was touched
  const COOL = 0.7;      // seconds for it to cool back to amber
  const EDGE = 16;       // css px: the width of the film's growing edge
  const RAGGED = 14;     // css px: how far the edge wanders ahead of or behind its mean
  const GRAIN = 0.012;   // the grain's lightness, either way

  // colours mixed in OKLab, as the tab's (js/anneal.js)
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const gam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  function toLab(hex) {
    const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function toRgb([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
      s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(c => 255 * Math.min(1, Math.max(0, gam(c))));
  }
  const STEPS = 48;
  // amber to each oxide colour
  const amber = toLab(STAGES[0]);
  const ramp = STAGES.map(c => {
    const b = toLab(c);
    return Array.from({ length: STEPS + 1 }, (_, i) => toRgb(amber.map((v, j) => v + (b[j] - v) * i / STEPS)));
  });

  const canvas = document.createElement('canvas');
  canvas.className = 'dl-metal'; canvas.setAttribute('aria-hidden', 'true');
  btn.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let NX = 0, NY = 0, img = null, ragged = null, grain = null, P = null;
  let stage = 0, origin = null, t0 = 0, reach = 0, mode = 'rest', on = false, coolFrom = 1, looping = false;

  // a smooth noise over the metal (for the film's edge) and a grain along it, made once a size
  function layout() {
    NX = Math.max(8, Math.round(btn.clientWidth / CELL)); NY = Math.max(4, Math.round(btn.clientHeight / CELL));
    canvas.width = NX; canvas.height = NY; img = ctx.createImageData(NX, NY);
    const L = 6, gx = Math.ceil(NX / L) + 2, gy = Math.ceil(NY / L) + 2;
    const lattice = Array.from({ length: gx * gy }, () => Math.random() * 2 - 1);
    const at = (i, j) => lattice[j * gx + i];
    const smooth = u => u * u * (3 - 2 * u);
    ragged = new Float32Array(NX * NY); grain = new Float32Array(NX * NY); P = new Float32Array(NX * NY);
    const rows = Array.from({ length: NY }, () => Math.random() * 2 - 1);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = i / L, y = j / L, xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
      const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * u, bot = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * u;
      ragged[j * NX + i] = top + (bot - top) * v;
      grain[j * NX + i] = GRAIN * (0.7 * rows[j] + 0.3 * (Math.random() * 2 - 1));
    }
  }

  // the metal: each cell's film, P (0 amber .. 1 the oxide colour), with the grain
  function paint() {
    const lut = ramp[stage], px = img.data;
    for (let n = 0; n < NX * NY; n++) {
      const c = lut[Math.round(P[n] * STEPS)], k = 1 + grain[n], o = n * 4;
      px[o] = Math.min(255, c[0] * k); px[o + 1] = Math.min(255, c[1] * k); px[o + 2] = Math.min(255, c[2] * k); px[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    let busy = false;
    if (mode === 'heat') {
      // the film grows behind a front running out from the touch, its edge uneven
      const front = t / TIME * reach;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const n = j * NX + i;
        const d = Math.hypot((i + 0.5) * CELL - origin[0], (j + 0.5) * CELL - origin[1]);
        const p = Math.min(1, Math.max(0, (front - d + RAGGED * ragged[n]) / EDGE));
        if (p > P[n]) P[n] = p;
        if (P[n] < 1) busy = true;
      }
      if (!busy) { if (on) mode = 'rest'; else { mode = 'cool'; coolFrom = 1; t0 = now; } }
    } else if (mode === 'cool') {
      // cooling back to amber, evenly
      const k = Math.max(0, 1 - t / COOL);
      for (let n = 0; n < NX * NY; n++) P[n] = Math.min(P[n], coolFrom * k);
      busy = k > 0;
      if (!busy) mode = 'rest';
    }
    paint();
    if (mode !== 'rest') requestAnimationFrame(frame); else looping = false;
  }
  const start = () => { if (!looping) { looping = true; requestAnimationFrame(frame); } };

  function heat(x, y) {
    if (mode === 'heat') return;
    if (mode === 'rest' && P.every(v => v === 0)) stage = stage % (STAGES.length - 1) + 1;   // the next colour, from amber
    origin = [x, y];
    const W = NX * CELL, H = NY * CELL;
    reach = Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)) + RAGGED + EDGE;
    mode = 'heat'; t0 = performance.now();
    start();
  }
  function cool() {
    if (mode === 'heat') return;               // it cools once the film has run its course
    coolFrom = 1; mode = 'cool'; t0 = performance.now();
    start();
  }

  layout(); paint();
  new ResizeObserver(() => {
    if (mode === 'rest' && (Math.round(btn.clientWidth / CELL) !== NX || Math.round(btn.clientHeight / CELL) !== NY)) { layout(); paint(); }
  }).observe(btn);
  btn.addEventListener('pointerenter', e => {
    if (e.pointerType === 'touch') return;
    on = true;
    const r = btn.getBoundingClientRect();
    heat(e.clientX - r.left, e.clientY - r.top);
  });
  btn.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { on = false; cool(); } });
  btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) { on = true; heat(btn.clientWidth / 2, btn.clientHeight / 2); } });
  btn.addEventListener('blur', () => { on = false; cool(); });
  // a phone has no pointer to bring onto it: it anneals once, the first time it is seen, and cools back
  if (matchMedia('(hover: none)').matches) {
    const seen = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      seen.disconnect();
      setTimeout(() => { on = true; heat(btn.clientWidth * 0.12, btn.clientHeight * 0.6); setTimeout(() => { on = false; cool(); }, 1600); }, 400);
    }, { threshold: 0.8 });
    seen.observe(btn);
  }
})();

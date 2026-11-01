/* The A tab, annealed. A flame touches the tab at one spot; the heat runs
 * out through the metal from there; where it is hot the oxide film
 * thickens, and the film's colour moves on to the next in titanium's
 * sequence, first at the spot, then out across the tab, until the whole tab
 * is that colour, evenly. The flame goes; the tab rests; the flame touches
 * again somewhere else. Amber, then the oxide's nine colours (the site's
 * --t100..--t900: bronze, purple, deep blue, blue, sky, gold, rose, violet,
 * teal), then amber again.
 *
 * The simulation: temperature on a grid over the tab (a cell a pixel, the
 * cut corner left out, drawn smoothed), the heat equation with the flame as a small
 * source and a little loss to the air; the film grows as the square of the
 * temperature, so the spot turns first and the far corner last. A step of
 * the film is one colour to the next, mixed in OKLab. It draws a dozen
 * times a second while the colour moves and not at all while it rests: the
 * page's own frames never wait on it. With reduced motion the tab is amber
 * and still. */
(() => {
  const W = 28, H = 24, CUT = 7, R = 1;               // the tab (css .tab), its cut corner, cells a pixel (drawn smoothed)
  const NX = W * R, NY = H * R;
  const SPREAD = 11.25 * R * R;   // cells² a second (11.25 px²): how fast the heat runs out from the spot
  const LOSS = 0.012;     // a second: the heat lost to the air
  const FLAME = 2.2;      // a second: the flame's heat, at its middle
  const SIGMA = 1.6 * R;  // cells: the flame's width (a touch)
  const GROW = 0.016;     // a second, per temperature²: how fast the film thickens
  const FPS = 12, REST = 20, FIRST = 4;               // draws a second while it moves; seconds at rest; seconds before the first touch
  const STAGES = ['#ffb000', '#a8804c', '#804799', '#4554cc', '#4087e6', '#a8cced', '#f2cc61', '#e67891', '#9e66d1', '#45c7a8'];

  // the colours, mixed in OKLab: 64 steps from each stage to the next
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
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(c => Math.round(255 * Math.min(1, Math.max(0, gam(c)))));
  }
  const STEPS = 64;
  const ramp = STAGES.map((c, k) => {
    const a = toLab(c), b = toLab(STAGES[(k + 1) % STAGES.length]);
    return Array.from({ length: STEPS + 1 }, (_, i) => toRgb(a.map((v, j) => v + (b[j] - v) * i / STEPS)));
  });
  const luminance = rgb => { const [r, g, b] = rgb.map(v => lin(v / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  // the tab's metal: the cells inside its outline
  const inside = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) inside[j * NX + i] = (i + 0.5) / R - (W - CUT) <= (j + 0.5) / R ? 1 : 0;
  const cells = [];
  for (let n = 0; n < NX * NY; n++) if (inside[n]) cells.push(n);

  // where a flame can touch: on the edge, or just in from it; the first time
  // at the cut corner, where the tab was first touched
  function spot(first, rand) {
    if (first) return [W - CUT / 2, CUT / 2];
    const t = rand() * (2 * W + 2 * H), inset = 1 + rand() * 2;
    if (t < W) return [t, inset];
    if (t < W + H) return [W - inset, t - W];
    if (t < 2 * W + H) return [t - W - H, H - inset];
    return [inset, t - 2 * W - H];
  }

  class Anneal {
    constructor(rand = Math.random) {
      this.rand = rand;
      this.T = new Float32Array(NX * NY); this.T2 = new Float32Array(NX * NY);
      this.u = new Float32Array(NX * NY);   // the film's step toward the next colour, 0..1
      this.src = new Float32Array(NX * NY);
      this.stage = 0; this.hot = false; this.touches = 0; this.flicker = 1;
    }
    touch() {
      const [fx, fy] = spot(this.touches === 0, this.rand);
      this.touches++;
      for (const n of cells) {
        const x = (n % NX + 0.5) / R, y = (Math.floor(n / NX) + 0.5) / R;
        this.src[n] = FLAME * Math.exp(-(((x - fx) ** 2 + (y - fy) ** 2) * R * R) / (2 * SIGMA * SIGMA));
      }
      this.u.fill(0); this.hot = true;
    }
    // advance by dt seconds; true when the film has stepped on and the tab is even
    step(dt) {
      const u = this.u, src = this.src;
      const sub = Math.max(1, Math.ceil(dt * SPREAD * 4.4)), h = dt / sub;   // explicit: stable under 1/(4 SPREAD) a step
      for (let s = 0; s < sub; s++) {
        const T = this.T, T2 = this.T2;
        // the flame flickers: its heat wanders a little about its mean
        this.flicker += (1 + 0.35 * (this.rand() * 2 - 1) - this.flicker) * Math.min(1, h * 3);
        const q = this.hot ? this.flicker : 0;
        for (const n of cells) {
          const t = T[n], i = n % NX;
          // the heat equation, insulated at the tab's edges (a missing neighbour is the cell itself)
          const l = i > 0 && inside[n - 1] ? T[n - 1] : t, r = i < NX - 1 && inside[n + 1] ? T[n + 1] : t;
          const up = n >= NX && inside[n - NX] ? T[n - NX] : t, dn = n < NX * (NY - 1) && inside[n + NX] ? T[n + NX] : t;
          T2[n] = t + h * (SPREAD * (l + r + up + dn - 4 * t) - LOSS * t + q * src[n]);
          if (this.hot && u[n] < 1) u[n] = Math.min(1, u[n] + h * GROW * t * t);
        }
        this.T = T2; this.T2 = T;
      }
      if (!this.hot) return false;
      for (const n of cells) if (u[n] < 1) return false;
      // even: the film is one step on everywhere; the flame goes
      this.hot = false; this.stage = (this.stage + 1) % STAGES.length; u.fill(0);
      return true;
    }
    // the colour of each cell into an RGBA buffer; the mean colour's luminance
    paint(px) {
      const lut = ramp[this.stage];
      let lum = 0, m = 0;
      for (let n = 0; n < NX * NY; n++) {
        const o = n * 4;
        if (!inside[n]) { px[o + 3] = 0; continue; }
        const c = lut[Math.round(this.u[n] * STEPS)];
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
        if ((n & 7) === 0) { lum += luminance(c); m++; }
      }
      return lum / m;
    }
  }

  if (typeof module !== 'undefined') { module.exports = { Anneal, NX, NY, FPS, REST, STAGES }; return; }

  const tab = document.querySelector('.tab');
  if (!tab || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.width = NX; canvas.height = NY; canvas.className = 'tab-metal'; canvas.setAttribute('aria-hidden', 'true');
  tab.prepend(canvas);
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(NX, NY);
  // ?anneal=N runs it N times as fast (to look at it)
  const speed = +(new URLSearchParams(location.search).get('anneal') || 1);
  const sim = new Anneal();
  let last = 0, dark = false;
  function draw() {
    const lum = sim.paint(img.data);
    ctx.putImageData(img, 0, 0);
    // the A in whichever ink reads better on the film: the night, or the paper
    const d = (lum + 0.05) / 0.055 < 1.06 / (lum + 0.05);
    if (d !== dark) { dark = d; tab.classList.toggle('tab-dark', d); }
  }
  function run() {
    const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000) * speed; last = now;
    if (document.hidden) { setTimeout(run, 1000); return; }      // a tab in the background: the metal waits
    if (sim.step(dt)) { draw(); setTimeout(begin, REST * 1000 / speed); return; }
    draw();
    setTimeout(run, 1000 / FPS);
  }
  function begin() { sim.touch(); last = performance.now(); run(); }
  draw();
  setTimeout(begin, FIRST * 1000 / speed);
})();

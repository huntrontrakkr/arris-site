/* The weight field, live: the film's ideas (media/weight-field.mp4) under
 * the visitor's hand, three specimens on one canvas.
 *
 *   Per point     a field of eights; the pointer is the source of an
 *                 outgoing cylindrical wave, Re H0(kr) e^(-iwt) =
 *                 J0(kr) cos wt + Y0(kr) sin wt, and the wave is weight:
 *                 every outline point takes its own, so one eight is Thin
 *                 on one side and Black on the other. A tap drops a wave
 *                 that rings and dies away.
 *   Nine weights  the same field, each figure at the named weight nearest
 *                 its centre, in that weight's titanium colour.
 *   Anodized      one letter as a slab of anodized titanium, cold enough
 *                 to sweat: water beads on it, gathers and runs. The
 *                 pointer is heat: it dries the metal and thickens the
 *                 oxide film, whose colour is its thickness (the same
 *                 sequence as the weights' colours).
 *
 * The outlines are the font's own (data/field.json, tools/field.py), at
 * every 50 of weight; between those the font is linear, and so is this.
 * Drawn only while on screen; with reduced motion the waves stand still
 * and follow the pointer, and the water does not creep. */
(() => {
  const root = document.getElementById('lf');
  if (!root) return;
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
  const note = root.querySelector('.lf-note'), letters = root.querySelector('.lf-letters');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const NIGHT = '#0c0e10';
  const TI = ['#a8804c', '#804799', '#4554cc', '#4087e6', '#a8cced', '#f2cc61', '#e67891', '#9e66d1', '#45c7a8']
    .map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
  const BARE = [141, 144, 148];                       // titanium before any film
  function tiRGB(w) {
    const u = clamp((w - 100) / 800, 0, 1) * 8, i = Math.min(7, Math.floor(u)), f = u - i;
    return TI[i].map((v, k) => Math.round(v + (TI[i + 1][k] - v) * f));
  }
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;

  // Bessel functions of the first and second kind, order 0 (rational and
  // asymptotic approximations, Abramowitz and Stegun 9.4)
  function j0(x) {
    const ax = Math.abs(x);
    if (ax < 8) {
      const y = x * x;
      return (57568490574 + y * (-13362590354 + y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))))) /
        (57568490411 + y * (1029532985 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y)))));
    }
    const z = 8 / ax, y = z * z, xx = ax - 0.785398164;
    return Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * (1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)))) -
      z * Math.sin(xx) * (-0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)))));
  }
  function y0(x) {
    if (x < 8) {
      const y = x * x;
      return (-2957821389 + y * (7062834065 + y * (-512359803.6 + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))))) /
        (40076544269 + y * (745249964.8 + y * (7189466.438 + y * (47447.2647 + y * (226.1030244 + y))))) + 0.636619772 * j0(x) * Math.log(x);
    }
    const z = 8 / x, y = z * z, xx = x - 0.785398164;
    return Math.sqrt(0.636619772 / x) * (Math.sin(xx) * (1 + y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)))) +
      z * Math.cos(xx) * (-0.1562499995e-1 + y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)))));
  }

  let D = null, mode = 'point', letter = '8';
  let W = 0, H = 0, dpr = 1, inView = false, raf = 0, last = 0, clock = 0;
  const ptr = { x: 0, y: 0, on: false, seen: false };
  let drops = [];                                      // waves dropped by a tap: { x, y, t0 }

  /* ------------------------------------------------------------ the outlines */
  // a glyph's points with a weight each: w a number, or (x, y) -> w of a
  // point's place at Regular, in font units
  function points(g, w, out) {
    const P = g.pts, n = P[0].length / 2, base = P[6], ws = D.weights;
    for (let k = 0; k < n; k++) {
      const wk = typeof w === 'number' ? w : w(base[2 * k], base[2 * k + 1]);
      const u = clamp((wk - ws[0]) / 50, 0, ws.length - 1 - 1e-6), i = Math.floor(u), f = u - i;
      out[2 * k] = P[i][2 * k] + (P[i + 1][2 * k] - P[i][2 * k]) * f;
      out[2 * k + 1] = P[i][2 * k + 1] + (P[i + 1][2 * k + 1] - P[i][2 * k + 1]) * f;
    }
    return n;
  }
  function trace(target, g, pts, x, y, s) {
    let k = 0;
    for (const end of g.ends) {
      target.moveTo(x + pts[2 * k] * s, y - pts[2 * k + 1] * s);
      for (k++; k <= end; k++) target.lineTo(x + pts[2 * k] * s, y - pts[2 * k + 1] * s);
      target.closePath();
    }
  }
  const buf = new Float32Array(512);

  /* ------------------------------------------------------------ the field of eights */
  let lay = null;
  function layField() {
    const cols = Math.max(7, Math.round(W / (52 * dpr))), cell = W / cols, rowH = cell * 1.34;
    const rows = Math.max(3, Math.floor(H / rowH)), g = D.glyphs['8'];
    const cap = cell * 0.78, s = cap / D.cap, adv = g.adv[6] * s;
    lay = { cols, rows, cell, rowH, s, cap, x0: (cell - adv) / 2, y0: (H - rows * rowH) / 2 + (rowH + cap) / 2, lambda: cell * 4.2 };
  }
  // the wave at a place: the pointer's (or, with none, a slow wanderer's), and the taps'
  function wave(x, y, t) {
    const k = 2 * Math.PI / lay.lambda, om = 2 * Math.PI / 1.5;
    let z = 0;
    const one = (sx, sy, tt, amp) => {
      const kr = Math.max(0.9, k * Math.hypot(x - sx, y - sy));
      z += amp * (j0(kr) * Math.cos(om * tt) + y0(kr) * Math.sin(om * tt));
    };
    one(src.x, src.y, t, 1);
    for (const d of drops) one(d.x, d.y, t - d.t0, Math.exp(-(t - d.t0) / 2.6));
    return z;
  }
  const src = { x: 0, y: 0 };
  const weightOf = z => 500 + 400 * Math.tanh(2.2 * z);
  function drawField(t) {
    const L = lay, g = D.glyphs['8'], named = mode === 'named';
    const tt = named ? t * 0.35 : t;
    if (ptr.on || (ptr.seen && still.matches)) { src.x += (ptr.x - src.x) * 0.2; src.y += (ptr.y - src.y) * 0.2; }
    else { src.x = W * (0.5 + 0.32 * Math.cos(t * 0.11)); src.y = H * (0.5 + 0.3 * Math.sin(t * 0.17)); }
    drops = drops.filter(d => tt - d.t0 < 9);
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < L.rows; r++) {
      for (let c = 0; c < L.cols; c++) {
        const x = c * L.cell + L.x0, y = L.y0 + r * L.rowH, cx = c * L.cell + L.cell / 2, cy = y - L.cap / 2;
        ctx.beginPath();
        if (named) {
          const w = Math.round(weightOf(wave(cx, cy, tt)) / 100) * 100;
          points(g, w, buf);
          trace(ctx, g, buf, x + (g.adv[6] - g.adv[(w - 100) / 50]) * L.s / 2, y, L.s);
          ctx.fillStyle = css(tiRGB(w));
        } else {
          points(g, (px, py) => weightOf(wave(x + px * L.s, y - py * L.s, tt)), buf);
          trace(ctx, g, buf, x, y, L.s);
          // the colour is the field itself, running through the figure away from the source
          let dx = cx - src.x, dy = cy - src.y;
          const d = Math.hypot(dx, dy) || 1, h = L.cell * 0.46;
          dx *= h / d; dy *= h / d;
          const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
          for (const [o, q] of [[0, -1], [0.5, 0], [1, 1]]) grad.addColorStop(o, css(tiRGB(weightOf(wave(cx + dx * q, cy + dy * q, tt)))));
          ctx.fillStyle = grad;
        }
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------------------ the anodized letter */
  let slab = null;
  const GW = 96;
  function laySlab() {
    const g = D.glyphs[letter], w = 800, wi = (w - 100) / 50;
    const cap = H * 0.66, s = cap / D.cap, adv = g.adv[wi] * s;
    const x = (W - adv) / 2, y = (H + cap) / 2 - (letter === 'g' ? cap * 0.12 : 0);
    points(g, w, buf);
    const path = new Path2D();
    trace(path, g, buf, x, y, s);
    const GH = Math.max(8, Math.round(GW * H / W));
    const heat = new Float32Array(GW * GH), tmp = new Float32Array(GW * GH), oxide = new Float32Array(GW * GH);
    // the film as the bath left it: an even blue, a little thicker toward the foot
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) oxide[j * GW + i] = 0.27 + 0.07 * j / GH + 0.02 * Math.sin(i * 0.9 + j * 0.37);
    const img = document.createElement('canvas');
    img.width = GW; img.height = GH;
    slab = { path, x, y, s, cap, adv, GH, heat, tmp, oxide, img, ictx: img.getContext('2d'), data: new ImageData(GW, GH), water: [], rain: 0,
      box: [x, y - cap * 1.05, adv, cap * (letter === 'g' ? 1.45 : 1.1)] };
    if (still.matches) for (let i = 0; i < 500; i++) stepWater(0.05, false);
    else for (let i = 0; i < 160; i++) stepWater(0.05, false);
  }
  // the film's colour by its thickness: bare metal, then titanium's sequence
  function film(o) {
    if (o < 0.06) { const f = o / 0.06, a = BARE, b = TI[0]; return a.map((v, k) => v + (b[k] - v) * f); }
    return tiRGB(100 + 800 * (o - 0.06) / 0.94);
  }
  const heatAt = (x, y) => {
    const S = slab, i = clamp(Math.floor(x / W * GW), 0, GW - 1), j = clamp(Math.floor(y / H * S.GH), 0, S.GH - 1);
    return S.heat[j * GW + i];
  };
  function stepHeat(dt) {
    const S = slab, { heat, tmp, oxide, GH } = S;
    if (ptr.on) {
      const ci = ptr.x / W * GW, cj = ptr.y / H * GH, R = GW * 0.075;
      for (let j = Math.max(0, Math.floor(cj - R)); j <= Math.min(GH - 1, Math.ceil(cj + R)); j++) {
        for (let i = Math.max(0, Math.floor(ci - R)); i <= Math.min(GW - 1, Math.ceil(ci + R)); i++) {
          const d = Math.hypot(i - ci, j - cj) / R;
          if (d < 1) heat[j * GW + i] = Math.min(1, heat[j * GW + i] + (1 - d * d) * 3.2 * dt);
        }
      }
    }
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        const k = j * GW + i, l = heat[j * GW + Math.max(0, i - 1)], r = heat[j * GW + Math.min(GW - 1, i + 1)];
        const u = heat[Math.max(0, j - 1) * GW + i], d = heat[Math.min(GH - 1, j + 1) * GW + i];
        tmp[k] = (heat[k] + 0.2 * (l + r + u + d - 4 * heat[k])) * (1 - 0.55 * dt);
      }
    }
    heat.set(tmp);
    for (let k = 0; k < heat.length; k++) if (heat[k] > 0.12) oxide[k] = Math.min(1, oxide[k] + (heat[k] - 0.12) * 0.34 * dt);
  }
  function stepWater(dt, live = true) {
    const S = slab, water = S.water, unit = Math.max(1, S.cap / 300);
    // new beads where the metal is cold
    S.rain += dt * 46;
    while (S.rain >= 1 && water.length < 420) {
      S.rain -= 1;
      const x = S.box[0] + Math.random() * S.box[2], y = S.box[1] + Math.random() * S.box[3];
      if (ctx.isPointInPath(S.path, x, y) && heatAt(x, y) < 0.08) water.push({ x, y, r: unit * (0.7 + Math.random() * 0.8), v: 0 });
    }
    if (S.rain > 3) S.rain = 3;
    for (const d of water) {
      const h = heatAt(d.x, d.y);
      if (h > 0.1) d.r -= (h - 0.1) * unit * 16 * dt;                 // dried by the heat
      else d.r += unit * 0.42 * dt / (1 + d.r / (unit * 5));         // growing, the big ones slowly
      if (d.r > unit * 9.5 || d.v > 0) {                             // heavy enough to run
        d.v = Math.min(unit * 150, d.v + unit * 240 * dt);
        d.y += d.v * dt;
        d.r -= unit * 0.9 * dt;
        if (live && Math.random() < 9 * dt) water.push({ x: d.x + (Math.random() - 0.5) * d.r * 0.5, y: d.y - d.r * 1.1, r: unit * (0.6 + Math.random() * 0.7), v: 0 });
        if (!ctx.isPointInPath(S.path, d.x, d.y + d.r * 0.4) || d.r < unit * 4) { d.v = 0; if (!ctx.isPointInPath(S.path, d.x, d.y)) d.r = 0; }
      }
    }
    // beads that touch are one bead
    water.sort((a, b) => b.r - a.r);
    for (let i = 0; i < water.length; i++) {
      const a = water[i];
      if (a.r <= 0) continue;
      for (let j = i + 1; j < water.length; j++) {
        const b = water[j];
        if (b.r <= 0) continue;
        const dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r * 0.6;
        if (dx * dx + dy * dy < rr * rr) {
          const A = a.r * a.r, B = b.r * b.r;
          a.x = (a.x * A + b.x * B) / (A + B); a.y = (a.y * A + b.y * B) / (A + B);
          a.r = Math.sqrt(A + B); a.v = Math.max(a.v, b.v);
          b.r = 0;
        }
      }
    }
    S.water = water.filter(d => d.r > unit * 0.45);
  }
  function drawSlab(t) {
    const S = slab, u = Math.max(1, S.cap / 300);
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, W, H);
    // the film
    const px = S.data.data;
    for (let k = 0; k < S.oxide.length; k++) {
      const c = film(S.oxide[k]), glow = Math.max(0, S.heat[k] - 0.45) * 90;
      px[4 * k] = Math.min(255, c[0] + glow); px[4 * k + 1] = Math.min(255, c[1] + glow * 0.5); px[4 * k + 2] = c[2]; px[4 * k + 3] = 255;
    }
    S.ictx.putImageData(S.data, 0, 0);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 26 * u; ctx.shadowOffsetY = 12 * u;
    ctx.fillStyle = '#222';
    ctx.fill(S.path);
    ctx.restore();
    ctx.save();
    ctx.clip(S.path);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(S.img, 0, 0, W, H);
    // brushed across, and a band of light that leans with the pointer
    ctx.globalAlpha = 0.07;
    for (let y = S.box[1], i = 0; y < S.box[1] + S.box[3]; y += 1.6 * u, i++) {
      ctx.fillStyle = (i * 7919) % 5 < 2 ? '#fff' : '#000';
      ctx.fillRect(S.box[0], y, S.box[2], 0.8 * u);
    }
    ctx.globalAlpha = 1;
    const lean = ptr.seen ? (ptr.x / W - 0.5) : 0.25 * Math.sin(t * 0.3);
    const sheen = ctx.createLinearGradient(S.x + S.adv * (0.1 + lean * 0.5), S.y - S.cap, S.x + S.adv * (0.75 + lean * 0.5), S.y);
    sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,.2)'); sheen.addColorStop(1, 'rgba(0,0,0,.16)');
    ctx.fillStyle = sheen;
    ctx.fillRect(S.box[0], S.box[1], S.box[2], S.box[3]);
    // the chamfer round its edge: lit above and to the left, dark below and to the right
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(0,0,0,.42)';
    ctx.translate(-2 * u, -2 * u); ctx.stroke(S.path);
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.translate(4 * u, 4 * u); ctx.stroke(S.path);
    ctx.translate(-2 * u, -2 * u);
    // the water
    for (const d of S.water) {
      const r = d.r, x = d.x, y = d.y;
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(x + r * 0.16, y + r * 0.24, r * 1.02, r * (d.v ? 1.12 : 1.02), 0, 0, 7); ctx.fill();
      if (r < 1.6 * u) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.55, 0, 7); ctx.fill(); continue; }
      const body = ctx.createLinearGradient(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
      body.addColorStop(0, 'rgba(0,0,0,.34)'); body.addColorStop(0.5, 'rgba(255,255,255,.04)'); body.addColorStop(1, 'rgba(255,255,255,.5)');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (d.v ? 1.12 : 1), 0, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(0.6, r * 0.09); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.36, y - r * 0.42, r * 0.2, r * 0.13, -0.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ running it */
  const NOTES = {
    point: 'Every outline point at its own weight. The pointer is the source of the wave; a tap drops another.',
    named: 'The same field, each figure at the named weight nearest its centre, in that weight’s colour.',
    anod: 'Anodized titanium, cold enough to sweat. The film’s colour is its thickness: hold the pointer on it to dry it and heat it.',
  };
  function size() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (!w || !h || (w === W && h === H && lay)) return;
    W = cv.width = w; H = cv.height = h;
    if (!ptr.seen) { ptr.x = W * 0.3; ptr.y = H * 0.45; }
    if (!D) return;
    layField();
    slab = null;
  }
  function frame(now) {
    raf = 0;
    if (!D || !inView || !W || !lay) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!still.matches) clock += dt;
    if (mode === 'anod') {
      if (!slab) laySlab();
      stepHeat(dt);
      if (!still.matches) stepWater(dt);
      drawSlab(clock);
    } else drawField(clock);
    if (!still.matches || ptr.on) go();
  }
  function go() { if (!raf && inView) { raf = requestAnimationFrame(frame); } }
  function set(m) {
    mode = m;
    root.querySelectorAll('.lf-tabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.s === m));
    letters.hidden = m !== 'anod';
    note.textContent = NOTES[m];
    slab = null;
    drops = [];
    last = performance.now();
    go();
  }
  root.querySelectorAll('.lf-tabs button').forEach(b => b.addEventListener('click', () => set(b.dataset.s)));
  letters.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    letter = b.dataset.ch;
    letters.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    slab = null;
    go();
  }));
  const place = e => { const r = cv.getBoundingClientRect(); ptr.x = (e.clientX - r.left) * dpr; ptr.y = (e.clientY - r.top) * dpr; ptr.seen = true; };
  cv.addEventListener('pointermove', e => { place(e); if (e.pointerType === 'mouse' || e.buttons) ptr.on = true; go(); });
  cv.addEventListener('pointerdown', e => {
    place(e); ptr.on = true;
    if (mode !== 'anod') { drops.push({ x: ptr.x, y: ptr.y, t0: (mode === 'named' ? 0.35 : 1) * clock }); if (drops.length > 3) drops.shift(); }
    go();
  });
  const leave = e => { if (e.pointerType !== 'mouse' || e.type === 'pointerleave') ptr.on = false; };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, leave);
  new ResizeObserver(() => { size(); go(); }).observe(cv);
  new IntersectionObserver(es => { inView = es[0].isIntersecting; last = performance.now(); go(); }, { rootMargin: '80px' }).observe(cv);
  fetch('data/field.json').then(r => r.json()).then(d => { D = d; size(); set('point'); }).catch(() => { root.hidden = true; });
})();

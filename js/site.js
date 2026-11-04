/* Arris: the site's behaviour. Everything the page states about the font
 * (version, character count, the character set) comes from data/font.json,
 * written from the release by tools/fonts.py. One place in the designspace
 * (LOC) is shared: the map, the sliders, the presets and the specimen card
 * all follow it. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // a moment worth counting, sent to GoatCounter as an event (once a visit
  // unless every time is asked); dropped quietly where the counter is blocked
  const counted = new Set();
  function track(path, title, every = false) {
    if (!every && counted.has(path)) return;
    counted.add(path);
    const send = () => { try { const gc = window.goatcounter; if (gc && typeof gc.count === 'function') gc.count({ path, title, event: true }); } catch (e) { /* not counted */ } };
    if (window.goatcounter && typeof window.goatcounter.count === 'function') send(); else addEventListener('load', send, { once: true });
  }
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

  /* ------------------------------------------------------------ layout that holds still
     Text that changes weight under the reader must not rewrap, or the page
     moves. So it is laid out once at its widest, Black at both ends of the
     watch axis, upright and italic (grade never changes a width): one line
     if it fits there at its size, or at no less than 0.8 of it; otherwise
     broken where the widest would break, and those breaks are kept whatever
     the axes do. Again only when its box or its words change. */
  const WIDEST = [[900, 0, 0, 'normal'], [900, 0, 100, 'normal'], [900, 0, 0, 'italic'], [900, 0, 100, 'italic']];
  function holdLines(text, el, ...mirrors) {
    el.style.fontSize = '';
    const cs = getComputedStyle(el), size = parseFloat(cs.fontSize), box = el.clientWidth;
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;font-family:${cs.fontFamily};font-size:${size}px;font-feature-settings:${cs.fontFeatureSettings}`;
    document.body.appendChild(probe);
    const wide = t => Math.max(...WIDEST.map(([w, g, x, st]) => {
      probe.style.fontVariationSettings = fvs(w, g, x); probe.style.fontStyle = st; probe.textContent = t;
      return probe.getBoundingClientRect().width;
    }));
    const words = text.trim().split(/\s+/).filter(Boolean), all = wide(words.join(' '));
    let lines, fit = size;
    if (all <= box) lines = [words.join(' ')];
    else if (box / all >= 0.8) { lines = [words.join(' ')]; fit = Math.floor(size * box / all * 10) / 10; }
    else {
      lines = [];
      for (const w of words) {
        const k = lines.length - 1;
        if (k >= 0 && wide(lines[k] + ' ' + w) <= box) lines[k] += ' ' + w; else lines.push(w);
      }
    }
    probe.remove();
    for (const t of [el, ...mirrors]) {
      t.style.fontSize = fit === size ? '' : fit + 'px';
      t.textContent = '';
      lines.forEach(l => { const s = document.createElement('span'); s.className = 'ln'; s.textContent = l; t.appendChild(s); });
    }
  }
  // the bar's height, for whatever is pinned under it
  const setBarH = () => document.documentElement.style.setProperty('--bar-h', $('.bar').offsetHeight + 'px');
  setBarH(); addEventListener('resize', setBarH);

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
  // Two of the three axes follow the pointer, one across and one down; the
  // readout's buttons pick which (picking the third lets go of the one picked
  // longest ago, and the new one takes its direction); the third rests.
  const mark = $('#mark');
  const HERO_AXES = ['wght', 'GRAD', 'WTCH'], HERO_VAR = { wght: '--w', GRAD: '--g', WTCH: '--x' };
  const HERO_SHOWN = { wght: $('#r-wght'), GRAD: $('#r-grad'), WTCH: $('#r-wtch') };
  const REST = { wght: 500, GRAD: 0, WTCH: 0 }, K = 70, C = 2 * Math.sqrt(70) * 0.42, ENDS = AX;
  const HERO_STILL = { wght: 0.5, GRAD: 0.2, WTCH: 0.2 };
  let picked = ['wght', 'WTCH'], pickDir = { wght: 'x', WTCH: 'y' };        // the oldest pick first
  const cur = reduce ? { ...REST } : { ...REST, wght: 900 }, vel = { wght: 0, GRAD: 0, WTCH: 0 }, aim = { ...cur };
  let springing = false, last = 0, sweep = !reduce, heroPoint = null;
  function draw() {
    for (const a of HERO_AXES) {
      const v = Math.round(cur[a]);
      mark.style.setProperty(HERO_VAR[a], v);
      HERO_SHOWN[a].textContent = v;
    }
    wake();
  }
  // the film: its copy follows the name through something thick (a lag of
  // about a sixth of a second), shows as much as it lags and the name moves,
  // and fades over a few seconds once the name is still; then it is hidden
  const film = $('#mark-film'), fBlur = $('#film-blur'), fDisp = $('#film-disp');
  const FILM_VAR = { wght: '--fw', GRAD: '--fg', WTCH: '--fx' }, FILM_SPAN = { wght: 110, GRAD: 55, WTCH: 25 };
  const filmAt = { ...REST };
  let glow = 0, filmOn = false, filmT = 0;
  function sizeFilm() {
    const fs = parseFloat(getComputedStyle(mark).fontSize);
    fBlur.setAttribute('stdDeviation', (fs * 0.05).toFixed(1)); fDisp.setAttribute('scale', (fs * 0.07).toFixed(1));
  }
  function filmStep(t) {
    const dt = Math.min(0.25, (t - filmT) / 1000 || 0.016); filmT = t;   // real time, so a slow device fades as soon as a fast one
    const a = 1 - Math.exp(-dt / 0.16);
    let stir = Math.abs(vel.wght) / 1400, settled = true;
    for (const k of HERO_AXES) {
      filmAt[k] += (cur[k] - filmAt[k]) * a;
      film.style.setProperty(FILM_VAR[k], filmAt[k].toFixed(1));
      stir += Math.abs(cur[k] - filmAt[k]) / FILM_SPAN[k];
      if (Math.abs(cur[k] - filmAt[k]) >= HERO_STILL[k]) settled = false;
    }
    glow = Math.max(glow * Math.exp(-dt / 0.7), Math.min(1, stir));
    film.style.opacity = (0.6 * glow).toFixed(3);
    if (glow < 0.008 && settled) { filmOn = false; film.style.visibility = 'hidden'; film.style.opacity = 0; return; }
    requestAnimationFrame(filmStep);
  }
  function wake() {
    if (reduce || filmOn) return;
    filmOn = true; film.style.visibility = 'visible'; filmT = performance.now(); requestAnimationFrame(filmStep);
  }
  sizeFilm(); addEventListener('resize', sizeFilm);
  function spring(t) {
    const dt = Math.min(0.034, (t - last) / 1000 || 0.016); last = t;
    let still = true;
    for (const k of HERO_AXES) {
      vel[k] += (K * (aim[k] - cur[k]) - C * vel[k]) * dt;
      cur[k] += vel[k] * dt;
      if (cur[k] < ENDS[k][0] || cur[k] > ENDS[k][1]) { cur[k] = clamp(cur[k], ...ENDS[k]); vel[k] = 0; }
      if (Math.abs(aim[k] - cur[k]) >= HERO_STILL[k] || Math.abs(vel[k]) >= HERO_STILL[k]) still = false;
    }
    draw();
    if (sweep === true && aim.wght === 100 && cur.wght === 100) {
      sweep = 'landed';
      setTimeout(() => { if (sweep) { sweep = false; pull(REST); } }, 160);
    }
    if (still) { Object.assign(cur, aim); draw(); springing = false; return; }
    requestAnimationFrame(spring);
  }
  function pull(target) {
    Object.assign(aim, target);
    if (reduce) { Object.assign(cur, aim); draw(); return; }
    if (!springing) { springing = true; last = performance.now(); requestAnimationFrame(spring); }
  }
  function heroAim(fx, fy) {
    const t = { ...REST };
    for (const a of picked) {
      const [lo, hi] = ENDS[a];
      t[a] = lo + (hi - lo) * (pickDir[a] === 'x' ? fx : fy);
    }
    return t;
  }
  function point(e) {
    sweep = false;
    const r = mark.getBoundingClientRect();
    heroPoint = [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
    pull(heroAim(...heroPoint));
  }
  mark.addEventListener('pointermove', point);
  mark.addEventListener('pointerdown', point);
  mark.addEventListener('pointerleave', () => { sweep = false; heroPoint = null; pull(REST); });

  const heroBtns = $$('.readout .ax');
  const HERO_TITLE = { x: 'follows the pointer across the name', y: 'follows the pointer down the name' };
  function showHeroAxes() {
    for (const b of heroBtns) {
      const a = b.dataset.ax, d = pickDir[a];
      b.setAttribute('aria-pressed', picked.includes(a));
      b.title = d ? `${a} ${HERO_TITLE[d]}` : `${a}: pick it to follow the pointer`;
    }
  }
  for (const b of heroBtns) {
    b.addEventListener('click', () => {
      const a = b.dataset.ax;
      if (picked.includes(a)) return;                              // always two: picking the third swaps one out
      const [drop, keep] = picked;
      pickDir = { [keep]: pickDir[keep], [a]: pickDir[drop] };             // the new one takes the dropped one's direction
      picked = [keep, a];
      showHeroAxes();
      sweep = false;
      pull(heroPoint ? heroAim(...heroPoint) : REST);             // the one let go rests; the new one takes the pointer
      track('/hero/axes/' + picked.slice().sort().join('-'), 'Hero axes: ' + picked.join(' and '));
    });
  }
  showHeroAxes();
  draw();
  if (sweep) {
    // the opening, once the face is in: Black, dropped to Thin, and let go
    // to rest in the middle
    document.fonts.load('1em Arris').catch(() => {}).then(() => setTimeout(() => { if (sweep) pull({ wght: 100 }); }, 450));
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

  // The weight rows set a pangram, one for the nine rows of a section so the
  // weights compare, and each load turns to the next: a counter kept in the
  // browser steps through both sets in order (without storage, any one). The
  // upright takes the fox and the ring's own; the italic the cyberpunk set
  // Jameson wrote (the credit is in the footer). A long line fades out at
  // the row's right edge.
  const PANGRAMS = [
    ['up', 'The quick brown fox jumps over the lazy dog.'],
    ['up', 'Two old pilots keep a dozen quiet roses in the Glasshouse; their horticulturist fixes the jammed valve by hand.'],
    ['up', 'Bay 09 took six tonnes of ice from the yard; the quartermaster wants every jump log and a zinc crate back by dawn.'],
    ['up', 'The scrubber halls exhale by the kilometre; farm decks fog every window, and a lazy pump squeaks on Ring 4 just past the midwatch.'],
    ['up', 'Spinward on the night line, a jukebox hums in the sleeper car: seven quiet berths, a frozen window, home by Ceres dawn.'],
    ['up', 'Noodles, all night: the cook jogs between six boiling vats, dockhands queue with pails, and the sign\'s fizz never quite dies by morning.'],
    ['up', 'Survey 4-A came back four days early with quartz, nickel, ice, and a sealed crate; the office won\'t explain, the dockmaster just shrugs.'],
    ['up', 'Linh wires home from Bến 07: quiet shifts, a kind dockmaster, jam sold out, big pay, zero sky, six more months, every one paid.'],
    ['up', 'Cutting corners where we can: the jig squares a block of zinc, five bevels a day, the hex key lost again by lunch, the apprentice blamed.'],
    ['up', 'Tier 2 badge: docks, ring line, medical. Quick with a wrench, slow at the exit queue after a shift, never once jumped the lazy gate at bay 09.'],
    ['up', 'Wake 05:10: rice ball, black coffee, a jar of plum jam, a dozing crew, and the sixth quiet hour over Ceres, every window rock.'],
    ['it', 'Jinxed cyborgs vow: quantum freaks zap hell.'],
    ['it', 'Quantum hackers jinx the grid; vexed bots flee my zapwork.'],
    ['it', 'Black-ice daemons quietly jump the vexed grid for wizards.'],
    ['it', 'Zero-day jackals quietly vex mainframes with bright spoofs.'],
    ['it', 'Neon jackals vex the quiet grid, zapping bytes from warped skulls.'],
    ['it', 'Sly AI ghosts quietly hijack vexed mainframes, buzzing with code pulses.'],
    ['it', 'Synthetic minds quietly vex the zealous grid, jacking power by fiber.'],
    ['it', 'The sly AI quietly jinxed every frozen backup, owning the margin.'],
    ['it', 'Quick, jam the vexed AI before it grows lazy and finds its pulse.'],
    ['it', 'Overclocked AI jesters quickly vex frozen grid humans, wiping backups.'],
  ];
  let turn = Math.floor(Math.random() * 1000);
  try {
    const kept = localStorage.getItem('arris-pangram');
    if (kept !== null) turn = +kept;
    localStorage.setItem('arris-pangram', turn + 1);
  } catch (e) { /* no storage: any one */ }
  const pangram = kind => { const set = PANGRAMS.filter(p => p[0] === kind); return set[turn % set.length][1]; };
  function weightRows(el, text) {
    for (let w = 100; w <= 900; w += 100) {
      const row = document.createElement('div');
      row.className = 'it-wrow';
      row.innerHTML = '<span class="it-wlabel"><i></i></span><span class="it-wtext"></span>';
      row.querySelector('i').style.background = TI[w / 100 - 1];
      row.querySelector('.it-wlabel').append(`${w} ${NAMES[w]}`);
      const t = row.querySelector('.it-wtext');
      t.textContent = text;
      t.style.fontVariationSettings = fvs(w, 0, 0);
      el.appendChild(row);
    }
  }
  // every weight row (these, the italic's and Mono's): its fades follow where
  // it is pushed to; a mouse drags it along, as a finger does
  document.addEventListener('scroll', e => {
    const t = e.target;
    if (!(t instanceof Element) || !t.classList.contains('it-wtext')) return;
    t.classList.toggle('moved', t.scrollLeft > 2);
    t.classList.toggle('end', t.scrollLeft + t.clientWidth >= t.scrollWidth - 2);
  }, { capture: true, passive: true });
  document.addEventListener('pointerdown', e => {
    const t = e.target instanceof Element && e.target.closest('.it-wtext');
    if (!t || e.pointerType !== 'mouse' || e.button !== 0) return;
    const x0 = e.clientX, s0 = t.scrollLeft;
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) { moved = true; t.classList.add('dragging'); t.setPointerCapture(e.pointerId); }
      t.scrollLeft = s0 - dx;
    };
    const up = () => {
      t.classList.remove('dragging');
      t.removeEventListener('pointermove', move); t.removeEventListener('pointerup', up); t.removeEventListener('pointercancel', up);
    };
    t.addEventListener('pointermove', move); t.addEventListener('pointerup', up); t.addEventListener('pointercancel', up);
  });
  // the nine weights, upright
  weightRows($('#up-weights'), pangram('up'));

  /* ------------------------------------------------------------ the designspace */
  // The space as the dimensions film drew it: a cube with ruled faces, the
  // place a point inside it. x is weight (Thin to Black, left to right), y
  // grade (down to up), z the watch (front to back). Dragging the cube turns
  // it; dragging the point moves it in
  // the two axes that face the eye most; 27 glyphs stand each at its own
  // place, the corners the space's extremes (a tap on one goes there).
  // It stays as it is set until someone turns it.
  const dsText = $('#ds-text'), dsStage = $('#ds-stage'), cubeEl = $('#ds-cube'), measure = $('#ds-measure');
  const backC = $('#ds-back'), frontC = $('#ds-front'), latEl = $('#ds-lattice');
  const bctx = backC.getContext('2d'), fctx = frontC.getContext('2d');
  const norm = (a, v) => (v - AX[a][0]) / (AX[a][1] - AX[a][0]);
  const denorm = (a, u) => AX[a][0] + clamp(u, 0, 1) * (AX[a][1] - AX[a][0]);
  const signed = (a, v) => (a === 'GRAD' && v > 0 ? '+' : '') + Math.round(v);
  const AX3 = ['wght', 'GRAD', 'WTCH'];
  // (the watch runs back from the front face: the plain font is nearest the eye)
  const SIDE = [1, 1, -1];
  const toP = l => AX3.map((a, k) => SIDE[k] * (norm(a, l[a]) * 2 - 1));
  const fromP = p => Object.fromEntries(AX3.map((a, k) => [a, denorm(a, (SIDE[k] * p[k] + 1) / 2)]));

  // the view: turned to show three faces, the eye a little above
  const dsView = { yaw: -0.6, pitch: 0.36 }, dsSpin = { yaw: 0, pitch: 0 };
  const EYE = 4.4;                                             // the eye's distance, in half-cubes
  let cW = 0, cH = 0, cS = 0, cCX = 0, cCY = 0, dsDirty = true, used = false;
  function rot([x, y, z]) {
    const yw = dsView.yaw, cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(dsView.pitch), sp = Math.sin(dsView.pitch);
    const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
    return [x1, cp * y - sp * z1, sp * y + cp * z1];
  }
  function proj(p) { const [x, y, z] = rot(p), k = EYE / (EYE - z); return [cCX + cS * x * k, cCY - cS * y * k, z, k]; }
  const CORNERS = [...Array(8)].map((_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1]);
  const EDGES = [];
  for (let i = 0; i < 8; i++) for (let b = 0; b < 3; b++) if (!(i & (1 << b))) EDGES.push([i, i | (1 << b), b]);
  // a face is (axis, side); it faces away when its outward normal does
  const facesAway = (k, s) => rot(k === 0 ? [s, 0, 0] : k === 1 ? [0, s, 0] : [0, 0, s])[2] < 0;

  // the 27 glyphs: the corners, the edges' and faces' middles, the centre
  const LAT = [];
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) for (const k of [-1, 0, 1]) {
    const s = document.createElement('span');
    s.textContent = 'A';
    const l = fromP([i, j, k]);
    s.style.fontVariationSettings = fvs(l.wght, l.GRAD, l.WTCH);
    s.style.color = titanium(l.wght);
    latEl.appendChild(s);
    LAT.push({ p: [i, j, k], l, el: s });
  }

  function dsSize() {
    const dpr = devicePixelRatio || 1, r = cubeEl.getBoundingClientRect();
    cW = r.width; cH = r.height; cCX = cW / 2; cCY = cH * 0.47; cS = Math.min(cW, cH * 1.08) * 0.228;
    for (const c of [backC, frontC]) { c.width = Math.round(cW * dpr); c.height = Math.round(cH * dpr); c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (cW) drawCube();                                       // at once: a resized canvas is blank until drawn
  }
  const seg = (ctx, a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  const atAx = (p, k, v) => { const q = p.slice(); q[k] = v; return q; };
  let dsHot = [];                                                // the axes the last move moved
  let dsTrail = [];
  function drawCube() {
    const b = bctx, f = fctx;
    b.clearRect(0, 0, cW, cH); f.clearRect(0, 0, cW, cH);
    // the faces turned away: ruled finely, as the film's walls
    const N = 8;
    b.lineWidth = 1;
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      if (!facesAway(k, s)) continue;
      const [u, v] = [0, 1, 2].filter(a => a !== k);
      b.strokeStyle = 'rgba(190, 206, 212, 0.075)';
      for (let i = 1; i < N; i++) {
        const t = -1 + 2 * i / N;
        let p0 = [0, 0, 0], p1 = [0, 0, 0];
        p0[k] = p1[k] = s; p0[u] = p1[u] = t; p0[v] = -1; p1[v] = 1; seg(b, proj(p0), proj(p1));
        p0 = [0, 0, 0]; p1 = [0, 0, 0];
        p0[k] = p1[k] = s; p0[v] = p1[v] = t; p0[u] = -1; p1[u] = 1; seg(b, proj(p0), proj(p1));
      }
    }
    // the edges: those between two faces turned away behind the glyphs, faint; the rest in front
    for (const [i, j, ax] of EDGES) {
      const c = CORNERS[i], others = [0, 1, 2].filter(a => a !== ax);
      const away = others.every(k => facesAway(k, c[k]));
      const ctx = away ? b : f;
      ctx.strokeStyle = away ? 'rgba(190, 206, 212, 0.22)' : 'rgba(214, 224, 226, 0.5)';
      ctx.lineWidth = 1;
      seg(ctx, proj(c), proj(CORNERS[j]));
    }
    // each axis named along the edge nearest the reader's eye for it, its ends marked
    const P = toP(LOC), far = ['900', '+100', '100'];
    const small = cW < 240;                                    // on a phone: the names only
    f.font = `${small ? 9 : 10}px "Arris Mono", ui-monospace, monospace`; f.textBaseline = 'middle';
    for (let ax = 0; ax < 3; ax++) {
      let best = null;
      for (const [i, j, e] of EDGES) {
        if (e !== ax) continue;
        const a = proj(CORNERS[i]), c = proj(CORNERS[j]), m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        const score = ax === 0 ? m[1] : ax === 1 ? -m[0] : m[1] + m[0] * 0.6;     // wght below, GRAD to the left, WTCH below to the right
        if (!best || score > best.score) best = { a, c, m, score };
      }
      const out = [best.m[0] - cCX, best.m[1] - cCY], ol = Math.hypot(...out) || 1, o = [out[0] / ol, out[1] / ol];
      const isHot = dsHot.includes(AX3[ax]);
      f.fillStyle = isHot ? '#ffb000' : 'rgba(170, 180, 182, 0.75)';
      f.textAlign = 'center';
      // kept inside the canvas: a name half off its edge reads as another word
      const half = f.measureText(AX3[ax]).width / 2 + 3;
      const lx = clamp(best.m[0] + o[0] * (small ? 12 : 18), half, cW - half), ly = clamp(best.m[1] + o[1] * (small ? 12 : 18), 8, cH - 8);
      f.fillText(AX3[ax], lx, ly);
      f.fillStyle = 'rgba(150, 160, 162, 0.6)';
      // only each axis's far end is numbered (its near end is where the others' near ends are)
      const hi = SIDE[ax] > 0 ? best.c : best.a, lo = SIDE[ax] > 0 ? best.a : best.c;
      if (!small) f.fillText(far[ax], hi[0] + (hi[0] - lo[0]) * 0.06 + o[0] * 12, hi[1] + (hi[1] - lo[1]) * 0.06 + o[1] * 12);
      // the place's tick on that edge
      const tp = best.a.map((v, n) => n < 2 ? v + (best.c[n] - v) * (P[ax] + 1) / 2 : 0);   // (a, c run -1 to 1 in the cube)
      f.strokeStyle = isHot ? '#ffb000' : 'rgba(214, 224, 226, 0.6)';
      seg(f, [tp[0] - o[0] * 4, tp[1] - o[1] * 4], [tp[0] + o[0] * 4, tp[1] + o[1] * 4]);
    }
    // the trail of a flight
    if (dsTrail.length > 1) {
      const n = dsTrail.length;
      f.lineWidth = 1.4; f.lineJoin = 'round';
      for (let i = 1; i < n; i++) {
        const a = proj(dsTrail[i - 1]), c = proj(dsTrail[i]);
        f.strokeStyle = `rgba(255, 176, 0, ${(0.08 + 0.7 * i / n).toFixed(3)})`;
        seg(f, a, c);
      }
    }
    // the place: lines from it to the three walls behind, and the point
    const pp = proj(P);
    f.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const s = facesAway(k, 1) ? 1 : -1, w = proj(atAx(P, k, s));
      f.strokeStyle = dsHot.includes(AX3[k]) ? 'rgba(255, 176, 0, 0.8)' : 'rgba(255, 176, 0, 0.42)';
      seg(f, pp, w);
      f.fillStyle = 'rgba(255, 176, 0, 0.7)';
      f.fillRect(w[0] - 1.5, w[1] - 1.5, 3, 3);
    }
    const g = f.createRadialGradient(pp[0], pp[1], 0, pp[0], pp[1], 26);
    g.addColorStop(0, 'rgba(255, 236, 200, 0.55)'); g.addColorStop(1, 'rgba(255, 176, 0, 0)');
    f.fillStyle = g; f.beginPath(); f.arc(pp[0], pp[1], 26, 0, 7); f.fill();
    f.fillStyle = '#fff6e6'; f.beginPath(); f.arc(pp[0], pp[1], 3.6, 0, 7); f.fill();
    // the glyphs, nearer ones clearer, the nearest to the place brighter
    const scale = cS / 150;
    for (const n of LAT) {
      const q = proj(n.p), d = Math.hypot(n.p[0] - P[0], n.p[1] - P[1], n.p[2] - P[2]);
      const a = clamp(0.2 + 0.5 * (q[2] + 1.2) / 2.4, 0.16, 0.72) + Math.max(0, 0.9 - d) * 0.4;
      n.el.style.transform = `translate(${q[0].toFixed(1)}px, ${q[1].toFixed(1)}px) scale(${(q[3] * scale).toFixed(3)}) translate(-50%, -54%)`;
      n.el.style.opacity = a.toFixed(3);
      n.el.style.zIndex = Math.round((q[2] + 2) * 100);
      n.q = q;
    }
  }

  // the line: its titanium (three colours along it, the weight's in the middle) and its measure
  function measureLine() {
    const lines = dsText.querySelectorAll('.ln');
    let w = 0;
    lines.forEach(l => { w = Math.max(w, l.getBoundingClientRect().width); });
    if (!lines.length) w = dsText.getBoundingClientRect().width;
    const em = w / parseFloat(getComputedStyle(dsText).fontSize);
    measure.style.setProperty('--mw', w.toFixed(1) + 'px');
    const graded = Math.round(LOC.GRAD) !== 0;
    measure.classList.toggle('held', graded);
    measure.querySelector('span').textContent = `${em.toFixed(2)} em${graded ? ' · grade keeps the width' : ''}`;
  }
  // the friction: the letters as titanium moving through air. As a letter
  // grows its edges run out into the air, as it shrinks they draw back, and an
  // edge that moves is heated by it and oxidises. A copy of each letter trails
  // it by a moment (red, the was layer) beside the letter as it is (green, the
  // now layer), each set on its own and centred on the letter's place in the
  // line, so the line's widening does not count, only the letter's own growth;
  // the line itself (blue) is the metal. The filter (#ds-friction) takes the
  // band between the two copies, the faster edge's the wider, blurs it into the
  // letter and colours it by how much heat that is: straw, then bronze, and at
  // the fastest a violet dusk. When the line stops the copy catches up in a
  // fraction of a second and the colour goes with it; at rest none of it is drawn
  const heatEl = $('#ds-heat'), dsLine = $('#ds-line'), dsNow = $('#ds-now'), dsWas = $('#ds-was'), heatBlur = $('#ds-heat-blur'), heatGain = $('#ds-heat-gain');
  // seconds the trailing copy takes to follow each axis (it is gone in about three): the
  // watch moves whole strokes, not just their edges, so its copy keeps closer
  const LAG = { wght: 0.13, GRAD: 0.13, WTCH: 0.06 };
  let lag = null, lagIt = false, frOn = false, frT = 0, frGlyphs = [];
  const frRange = document.createRange();
  function rebuildFriction() {
    dsNow.textContent = ''; dsWas.textContent = ''; frGlyphs = [];
    for (const t of [dsNow, dsWas]) t.style.fontSize = dsText.style.fontSize;
    dsLine.querySelectorAll('.ln').forEach(ln => {
      const node = ln.firstChild;
      if (!node) return;
      let i = 0;
      for (const ch of node.textContent) {
        const j = i + ch.length;
        if (ch.trim()) {
          const now = document.createElement('span'), was = document.createElement('span');
          now.textContent = was.textContent = ch; dsNow.appendChild(now); dsWas.appendChild(was);
          frGlyphs.push({ node, i, j, ln, now, was });
        }
        i = j;
      }
    });
    if (frOn) placeFriction();
  }
  function placeFriction() {
    // the heat spreads about as far into the letter as its stroke is thick, and a thin
    // stroke carries less of it: a hairline warms at its edge, it does not glow through
    const u = norm('wght', LOC.wght), fs = parseFloat(getComputedStyle(dsText).fontSize);
    heatBlur.setAttribute('stdDeviation', (fs * (0.009 + 0.014 * u)).toFixed(2));
    heatGain.setAttribute('slope', (0.45 + 1.25 * u).toFixed(2));
    dsWas.style.fontVariationSettings = fvs(lag.wght, lag.GRAD, lag.WTCH);
    dsWas.style.fontStyle = dsNow.style.fontStyle = dsLine.style.fontStyle;
    // every reading first, then every placing: one layout a frame
    const o = dsLine.getBoundingClientRect();
    const at = frGlyphs.map(g => {
      frRange.setStart(g.node, g.i); frRange.setEnd(g.node, g.j);
      return [frRange.getBoundingClientRect().left - o.left, g.ln.offsetTop, g.now.getBoundingClientRect().width, g.was.getBoundingClientRect().width];
    });
    frGlyphs.forEach((g, n) => {
      const [x, y, wn, ww] = at[n];
      g.now.style.transform = `translate(${x.toFixed(2)}px, ${y}px)`;
      g.was.style.transform = `translate(${(x + (wn - ww) / 2).toFixed(2)}px, ${y}px)`;
    });
  }
  function frStep(t) {
    const dt = Math.min(0.05, (t - frT) / 1000 || 0.016); frT = t;
    let off = 0;
    for (const a of AX3) { lag[a] += (LOC[a] - lag[a]) * (1 - Math.exp(-dt / LAG[a])); off = Math.max(off, Math.abs(LOC[a] - lag[a]) / (AX[a][1] - AX[a][0])); }
    if (off < 0.003) { frOn = false; heatEl.style.visibility = 'hidden'; return; }
    placeFriction();
    requestAnimationFrame(frStep);
  }
  function touch() {
    if (reduce || !frGlyphs.length) return;
    // first sight, or a change of style, is no motion and no heat
    if (!lag || LOC.ital !== lagIt) { lag = { wght: LOC.wght, GRAD: LOC.GRAD, WTCH: LOC.WTCH }; lagIt = LOC.ital; return; }
    if (frOn) { placeFriction(); return; }       // (placed again after the line changes, so no frame shows them a step apart)
    if (AX3.every(a => LOC[a] === lag[a])) return;
    frOn = true; heatEl.style.visibility = 'visible'; frT = performance.now();
    placeFriction(); requestAnimationFrame(frStep);
  }
  function renderDS() {
    const v = fvs(LOC.wght, LOC.GRAD, LOC.WTCH), w = LOC.wght;
    dsText.style.fontVariationSettings = v;
    dsText.style.fontStyle = LOC.ital ? 'italic' : 'normal';
    dsLine.style.fontVariationSettings = dsNow.style.fontVariationSettings = v;
    dsLine.style.fontStyle = dsText.style.fontStyle;
    touch();
    for (const a of AX3) {
      const s = $('#s-' + a), u = norm(a, LOC[a]);
      if (+s.value !== Math.round(LOC[a])) s.value = Math.round(LOC[a]);
      s.style.setProperty('--u', u.toFixed(4));
      $('#o-' + a).textContent = signed(a, LOC[a]);
      document.querySelector(`.dsx-g[data-ax="${a}"]`).classList.toggle('hot', dsHot.includes(a));
      document.querySelector(`.dsx-axes [data-ax="${a}"]`).classList.toggle('hot', dsHot.includes(a));
    }
    const near = Math.round(w / 100) * 100;
    $('#n-wght').textContent = Math.abs(w - near) < 0.5 ? NAMES[near] : `near ${NAMES[near]}`;
    LAT.forEach(n => { n.el.style.fontStyle = LOC.ital ? 'italic' : 'normal'; });
    pressSwitch($('#ds-it'), $('#ds-up'), LOC.ital);
    $('#ds-css').textContent = `font-variation-settings: ${v};${LOC.ital ? ' font-style: italic;' : ''}`;
    cubeEl.setAttribute('aria-valuetext', `weight ${Math.round(LOC.wght)}, grade ${Math.round(LOC.GRAD)}, watch ${Math.round(LOC.WTCH)}`);
    $$('#ds-presets button').forEach(b => {
      const p = PRESETS[b.dataset.i][1];
      b.setAttribute('aria-pressed', Object.keys(p).every(k => Math.round(LOC[k]) === p[k]));
    });
    measureLine();
    dsDirty = true;
  }
  subs.push(renderDS);

  // moving: the point, the cube, the keyboard, the gauges, the named places, the flight
  let dsFlying = false, dsTween = null, hotTimer = 0;
  const dsStop = () => { dsFlying = false; dsTween = null; $('#ds-fly').setAttribute('aria-pressed', false); };
  const heat = axes => { dsHot = axes; clearTimeout(hotTimer); hotTimer = setTimeout(() => { dsHot = []; renderDS(); }, 900); };
  const local = e => { const r = cubeEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let dsDrag = null;
  cubeEl.addEventListener('pointerdown', e => {
    const [x, y] = local(e), pp = proj(toP(LOC));
    const onPoint = Math.hypot(x - pp[0], y - pp[1]) < 24;
    dsDrag = { mode: onPoint ? 'move' : 'turn', x, y, x0: x, y0: y, t: performance.now() };
    cubeEl.setPointerCapture(e.pointerId);
    dsSpin.yaw = dsSpin.pitch = 0;
    if (onPoint) dsStop();
    used = true; cubeEl.classList.add('used');
    cubeEl.classList.toggle('turning', !onPoint);
    e.preventDefault();
  });
  cubeEl.addEventListener('pointermove', e => {
    const [x, y] = local(e);
    if (!dsDrag) {
      const pp = proj(toP(LOC));
      cubeEl.classList.toggle('on-point', Math.hypot(x - pp[0], y - pp[1]) < 24);
      return;
    }
    const dx = x - dsDrag.x, dy = y - dsDrag.y, now = performance.now(), dt = Math.max(1, now - dsDrag.t);
    dsDrag.x = x; dsDrag.y = y; dsDrag.t = now;
    if (dsDrag.mode === 'turn') {
      dsView.yaw += dx * 0.009; dsView.pitch = clamp(dsView.pitch + dy * 0.007, -0.25, 1.1);
      dsSpin.yaw = dx * 0.009 / dt * 16; dsSpin.pitch = dy * 0.007 / dt * 16;
      dsDirty = true;
      return;
    }
    // the point, moved in the two axes whose lines run most across the screen here
    const P = toP(LOC), p0 = proj(P), J = [0, 1, 2].map(k => { const q = proj(atAx(P, k, P[k] + 0.01)); return [(q[0] - p0[0]) / 0.01, (q[1] - p0[1]) / 0.01]; });
    if (!dsDrag.pair) dsDrag.pair = [0, 1, 2].sort((m, n) => Math.hypot(...J[n]) - Math.hypot(...J[m])).slice(0, 2);   // chosen once, for the whole drag
    const [a, c] = dsDrag.pair;
    const det = J[a][0] * J[c][1] - J[c][0] * J[a][1];
    if (Math.abs(det) < 1e-6) return;
    const da = (dx * J[c][1] - dy * J[c][0]) / det, dc = (J[a][0] * dy - J[a][1] * dx) / det;
    P[a] = clamp(P[a] + da, -1, 1); P[c] = clamp(P[c] + dc, -1, 1);
    heat([AX3[a], AX3[c]]);
    setLoc(fromP(P));
  });
  const endDrag = e => {
    if (!dsDrag) return;
    const [x, y] = local(e);
    if (dsDrag.mode === 'turn' && Math.hypot(x - dsDrag.x0, y - dsDrag.y0) < 4) {
      // a tap on a glyph goes to its place
      let best = null;
      for (const n of LAT) if (n.q) { const d = Math.hypot(x - n.q[0], y - n.q[1]); if (d < 22 * Math.max(0.8, n.q[3]) && (!best || d < best.d)) best = { d, n }; }
      if (best) glide(Object.fromEntries(AX3.map(a => [a, Math.round(best.n.l[a])])));
    }
    if (performance.now() - dsDrag.t > 60) dsSpin.yaw = dsSpin.pitch = 0;    // let go still: no throw
    dsDrag = null; cubeEl.classList.remove('turning');
  };
  cubeEl.addEventListener('pointerup', endDrag);
  cubeEl.addEventListener('pointercancel', endDrag);
  cubeEl.addEventListener('pointerleave', () => { if (!dsDrag) cubeEl.classList.remove('on-point'); });
  cubeEl.addEventListener('dblclick', () => { dsView.yaw = -0.6; dsView.pitch = 0.36; dsSpin.yaw = dsSpin.pitch = 0; dsDirty = true; });
  cubeEl.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const mv = { ArrowLeft: ['wght', -step], ArrowRight: ['wght', step], ArrowUp: ['GRAD', step], ArrowDown: ['GRAD', -step], PageUp: ['WTCH', 0.05], PageDown: ['WTCH', -0.05] }[e.key];
    if (!mv) return;
    e.preventDefault(); dsStop(); heat([mv[0]]);
    setLoc({ [mv[0]]: LOC[mv[0]] + mv[1] * (AX[mv[0]][1] - AX[mv[0]][0]) });
  });
  for (const a of AX3) $('#s-' + a).addEventListener('input', e => { dsStop(); heat([a]); setLoc({ [a]: +e.target.value }); });
  $('#ds-up').addEventListener('click', () => setLoc({ ital: false }));
  $('#ds-it').addEventListener('click', () => setLoc({ ital: true }));
  const holdDS = () => { holdLines(dsText.innerText, dsText, dsLine); rebuildFriction(); measureLine(); };
  dsText.addEventListener('blur', holdDS);
  dsText.addEventListener('input', () => {
    dsLine.textContent = '';
    [...dsText.childNodes].forEach(n => { const l = document.createElement('span'); l.className = 'ln'; l.textContent = n.textContent; dsLine.appendChild(l); });
    rebuildFriction(); measureLine();
  });
  document.fonts.ready.then(() => { holdDS(); dsDirty = true; });
  let dsW = 0;
  new ResizeObserver(() => {
    dsSize();
    if (dsText.clientWidth !== dsW && document.activeElement !== dsText) { dsW = dsText.clientWidth; holdDS(); }
  }).observe(cubeEl);
  $('#ds-copy').addEventListener('click', () => {
    const note = $('#ds-copy .dsx-copied');
    navigator.clipboard.writeText($('#ds-css').textContent).then(() => { note.textContent = 'copied'; }, () => { note.textContent = 'select to copy'; });
    setTimeout(() => { note.textContent = ''; }, 1800);
  });

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
    dsStop();
    heat(Object.keys(to).filter(k => Math.round(LOC[k]) !== to[k]));
    if (reduce) { setLoc(to); return; }
    const from = { wght: LOC.wght, GRAD: LOC.GRAD, WTCH: LOC.WTCH }, t0 = performance.now(), me = dsTween = {};
    (function step(t) {
      if (dsTween !== me) return;
      const u = clamp((t - t0) / 800, 0, 1), e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
      setLoc(Object.fromEntries(Object.keys(to).map(k => [k, from[k] + (to[k] - from[k]) * e])));
      if (u < 1) requestAnimationFrame(step);
    })(t0);
  }
  // the fly-through follows the Lorenz attractor (sigma 10, rho 28, beta 8/3):
  // x is weight, y grade, z the watch; its trail is drawn in the cube
  const LZ = { x: 19.5, y: 27, z: 48 };
  const toLoc = ([x, y, z]) => ({ wght: 500 + 400 * clamp(x / LZ.x, -1, 1), GRAD: 100 * clamp(y / LZ.y, -1, 1), WTCH: 100 * clamp(1 - z / LZ.z, 0, 1) });
  const lorenz = ([x, y, z]) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
  function rk4(p, h) {
    const add = (a, b, k) => a.map((v, i) => v + b[i] * k);
    const k1 = lorenz(p), k2 = lorenz(add(p, k1, h / 2)), k3 = lorenz(add(p, k2, h / 2)), k4 = lorenz(add(p, k3, h));
    return p.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  let onAttractor = [1, 1, 1];
  for (let i = 0; i < 6250; i++) onAttractor = rk4(onAttractor, 0.004);
  $('#ds-fly').addEventListener('click', e => {
    if (dsFlying) { dsStop(); return; }
    const btn = e.currentTarget;
    dsTrail = [];
    glide(toLoc(onAttractor));
    setTimeout(() => {
      dsTween = null; dsFlying = true;
      btn.setAttribute('aria-pressed', true);
      let last = performance.now();
      const STEP = 0.004, RATE = 0.42;          // attractor time per second
      (function fly(t) {
        if (!dsFlying) return;
        const steps = Math.max(1, Math.round(RATE * Math.min(0.05, (t - last) / 1000) / STEP)); last = t;
        for (let i = 0; i < steps; i++) onAttractor = rk4(onAttractor, STEP);
        const l = toLoc(onAttractor);
        dsTrail.push(toP(l)); if (dsTrail.length > 900) dsTrail.shift();
        setLoc(l);
        requestAnimationFrame(fly);
      })(last);
    }, reduce ? 0 : 820);
  });

  // one loop while the cube is on screen: a throw's glide to rest, and the drawing
  let dsVisible = false, dsLooping = false;
  new IntersectionObserver(es => { dsVisible = es[0].isIntersecting; if (dsVisible && !dsLooping) { dsLooping = true; dsDirty = true; requestAnimationFrame(dsTick); } }).observe(cubeEl);
  function dsTick(t) {
    if (!dsVisible) { dsLooping = false; return; }
    if (!dsDrag && (Math.abs(dsSpin.yaw) > 1e-4 || Math.abs(dsSpin.pitch) > 1e-4)) {
      dsView.yaw += dsSpin.yaw; dsView.pitch = clamp(dsView.pitch + dsSpin.pitch, -0.25, 1.1);
      dsSpin.yaw *= 0.94; dsSpin.pitch *= 0.94; dsDirty = true;
    }
    if (dsFlying && dsTrail.length) dsDirty = true;
    if (dsDirty && cW) { drawCube(); dsDirty = false; }
    requestAnimationFrame(dsTick);
  }
  dsSize();

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
  weightRows($('#it-weights'), pangram('it'));

  /* ------------------------------------------------------------ films: play in view */
  const vids = $$('video:not([data-scrub])');   // a scrubbed film follows the scroll instead (belt.js)
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.preload = 'auto'; e.target.play().catch(() => {}); } else e.target.pause();
    }), { threshold: 0.35 });
    // a film starts loading a screen before it is in view, so it is
    // buffered when it plays and does not start as the reader arrives
    const early = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.preload = 'auto'; early.unobserve(e.target); }
    }), { rootMargin: '100% 0px' });
    vids.forEach(v => { io.observe(v); early.observe(v); });
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
      b.addEventListener('click', () => { if (g !== group) { toSetTop(); openGroup(g); } });
      bar.appendChild(b);
    });
    openGroup('Latin');
  }

  // The set is one surface beside the pinned card: a reader deep in the
  // Latin who opens Figures had the page shorten under them and was thrown
  // on past the set. A group opened from the tabs starts at the set's top,
  // under the card, at once (no smooth scroll across a long set)
  function toSetTop() {
    const grid = $('#grid'), card = $('#card');
    const y = grid.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(card).top);
    if (scrollY > y) scrollTo({ top: y, behavior: 'instant' });
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
  const CL = { wght: 400, GRAD: 0, WTCH: 0, ital: false, mono: false };
  // Mono is static: six weights, Light to Bold with Retina (450), upright and
  // italic. On the card the weight snaps to the nearest and the other axes rest at 0
  const MONO_W = { 300: 'Light', 400: 'Regular', 450: 'Retina', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };
  const monoW = w => +Object.keys(MONO_W).reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));
  const METRICS = [['ASCENDER', 'ascender'], ['CAP HEIGHT', 'cap'], ['X-HEIGHT', 'x'], ['BASELINE', null], ['DESCENDER', 'descender']];
  function layoutCard() {
    const M = FONT ? FONT.metrics : { upm: 1000, ascender: 975, descender: -250, cap: 720, x: 540 };
    const fill = matchMedia('(max-width: 860px)').matches ? 0.86 : 0.66;   // the compact card (phones): the character fills its stage, the metrics as tags
    // the size the stage's height allows, and no more than its width does: an em in 0.72 of it, so a
    // wide character stays inside on a tall screen (at 3840×2160 the A ran out of the pane)
    const H = stage.clientHeight, W = stage.clientWidth || H;
    const S = Math.min(H * fill / ((M.ascender - M.descender) / M.upm), W * 0.72), top = (H - S * (M.ascender - M.descender) / M.upm) / 2;
    glyph.style.fontSize = S + 'px';
    glyph.style.top = top + 'px';
    glyph.style.lineHeight = (M.ascender - M.descender) / M.upm;
    let lastLeft = -Infinity;
    linesEl.innerHTML = METRICS.map(([n, k]) => {
      const v = k ? M[k] : 0, y = top + (M.ascender - v) / M.upm * S;
      const right = y - lastLeft < 18;                    // a label would touch the one above: it goes to the right
      if (!right) lastLeft = y;
      return `<div class="${k ? '' : 'base'}${right ? ' r' : ''}" style="top:${y.toFixed(1)}px"><span><b>${n}</b> ${v}</span></div>`;
    }).join('');
    return { M, S };
  }
  let cardM = null;
  function drawCard() {
    if (!cardM) cardM = layoutCard();
    if (CL.mono) { CL.wght = monoW(CL.wght); CL.GRAD = CL.WTCH = 0; }
    glyph.style.fontFamily = CL.mono ? '"Arris Mono", monospace' : '';
    glyph.style.fontWeight = CL.mono ? CL.wght : '';
    glyph.style.fontVariationSettings = CL.mono ? 'normal' : fvs(CL.wght, CL.GRAD, CL.WTCH);
    glyph.style.fontStyle = CL.ital ? 'italic' : 'normal';
    pressSwitch($('#card-it'), $('#card-up'), CL.ital);
    $('#card-mono').setAttribute('aria-checked', CL.mono);
    // the sheet of characters follows the card: style, family and place
    const grid = $('#grid');
    grid.style.fontFamily = glyph.style.fontFamily; grid.style.fontWeight = glyph.style.fontWeight;
    grid.style.fontVariationSettings = glyph.style.fontVariationSettings; grid.style.fontStyle = glyph.style.fontStyle;
    const adv = Math.round(chEl.getBoundingClientRect().width / cardM.S * cardM.M.upm);
    $('#card-metrics').innerHTML = CL.mono
      ? `<span>ADVANCE ${adv}</span><span class="ax-wght">wght ${CL.wght} ${MONO_W[CL.wght]}</span><span>Mono: six weights, Light to Bold</span>`
      : `<span>ADVANCE ${adv}</span><span class="ax-wght">wght ${Math.round(CL.wght)}</span><span class="ax-GRAD">GRAD ${signed('GRAD', CL.GRAD)}</span><span class="ax-WTCH">WTCH ${Math.round(CL.WTCH)}</span>`;
    drawTri();
  }
  // the face the card needs, loaded before its advance is measured
  const loadCard = () => document.fonts.load(`${CL.ital ? 'italic' : 'normal'} ${CL.mono ? CL.wght : 400} 24px ${CL.mono ? '"Arris Mono"' : 'Arris'}`, chEl.textContent).then(drawCard);
  let stageH = 0, stageW = 0;
  new ResizeObserver(() => { if (stage.clientHeight !== stageH || stage.clientWidth !== stageW) { stageH = stage.clientHeight; stageW = stage.clientWidth; cardM = layoutCard(); drawCard(); } }).observe(stage);
  function step(d) {
    const list = groups[group]; if (!list) return;
    select(list[clamp(list.indexOf(sel) + d, 0, list.length - 1)]);
    const b = $(`#grid button[aria-selected="true"]`); if (b) b.scrollIntoView({ block: 'nearest' });
  }
  $('#card-prev').addEventListener('click', () => step(-1));
  $('#card-next').addEventListener('click', () => step(1));
  let swipe = null;
  stage.addEventListener('pointerdown', e => { swipe = [e.clientX, e.clientY]; });
  stage.addEventListener('pointerup', e => {
    if (!swipe) return;
    const dx = e.clientX - swipe[0], dy = e.clientY - swipe[1]; swipe = null;
    if (Math.abs(dx) > 36 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
  });
  // the script tabs live at the foot of the examiner
  $('#card').appendChild($('#groups'));
  $('#card-up').addEventListener('click', () => { CL.ital = false; drawCard(); loadCard(); });
  $('#card-it').addEventListener('click', () => { CL.ital = true; drawCard(); loadCard(); });
  $('#card-mono').addEventListener('click', () => { CL.mono = !CL.mono; drawCard(); if (CL.mono) loadCard(); });

  // The triangle: each axis runs along a median, from the middle of the
  // opposite edge (t = 0) to its vertex (t = 1). The axes do not end alike,
  // so each is placed by its default: the centroid (t = 1/3) is Regular,
  // wght 400, GRAD 0 and WTCH 0 at once. Weight and grade run on below it,
  // to Thin and to -100; the watch starts there. Each axis is a track with
  // a tick at its default, a knob beside the track (to its right, so the
  // three sit apart when they share the centre) and a bar from the default
  // to the knob; the shape the three points draw is the place's signature.
  const TRI = {
    wght: { v: [120, 14], to: v => v <= 400 ? (v - 100) / 900 : 1 / 3 + (v - 400) / 750, from: t => t <= 1 / 3 ? 100 + t * 900 : 400 + (t - 1 / 3) * 750, lo: 0, name: 'Weight', ends: ['100', '900'] },
    GRAD: { v: [16, 194], to: v => v <= 0 ? (v + 100) / 300 : 1 / 3 + v / 150, from: t => t <= 1 / 3 ? -100 + t * 300 : (t - 1 / 3) * 150, lo: 0, name: 'Grade', ends: ['-100', '+100'] },
    WTCH: { v: [224, 194], to: v => 1 / 3 + v / 150, from: t => (t - 1 / 3) * 150, lo: 1 / 3, name: 'Watch', ends: ['0', '100'] },
  };
  const AXES = ['wght', 'GRAD', 'WTCH'], LETTER = { wght: 'W', GRAD: 'G', WTCH: 'T' }, KNOB = 14;
  AXES.forEach(a => {
    const [o1, o2] = AXES.filter(b => b !== a).map(b => TRI[b].v);
    TRI[a].m = [(o1[0] + o2[0]) / 2, (o1[1] + o2[1]) / 2];
    const dx = TRI[a].v[0] - TRI[a].m[0], dy = TRI[a].v[1] - TRI[a].m[1], L = Math.hypot(dx, dy);
    TRI[a].n = [-dy / L, dx / L];                      // the track's right-hand side
  });
  const at = (a, t) => [TRI[a].m[0] + t * (TRI[a].v[0] - TRI[a].m[0]), TRI[a].m[1] + t * (TRI[a].v[1] - TRI[a].m[1])];
  const tri = $('#tri'), NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent = tri) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const f1 = v => v.toFixed(1);
  el('polygon', { points: AXES.map(a => TRI[a].v.join(',')).join(' '), class: 'tri-edge' });
  const parts = {};
  const tick = (a, t, r, cls, parent) => { const q = at(a, t), n = TRI[a].n; return el('line', { x1: f1(q[0] - n[0] * r), y1: f1(q[1] - n[1] * r), x2: f1(q[0] + n[0] * r), y2: f1(q[1] + n[1] * r), class: cls }, parent); };
  AXES.forEach(a => {
    const p0 = at(a, TRI[a].lo), p1 = at(a, 1), n = TRI[a].n;
    const track = el('line', { x1: f1(p0[0]), y1: f1(p0[1]), x2: f1(p1[0]), y2: f1(p1[1]), class: `tri-track ax-${a}` });
    tick(a, 1 / 3, 4, 'tri-tick');                      // the default
    if (a === 'wght') { tick(a, TRI.wght.to(400), 5, 'tri-tick tri-tick-mono'); tick(a, TRI.wght.to(700), 5, 'tri-tick tri-tick-mono'); }   // where Mono snaps
    const fill = el('line', { class: `tri-fill ax-${a}` });
    parts[a] = { track, fill };
  });
  // the ends: the axis at its vertex, the low end at the foot
  const label = (x, y, anchor, text, cls = 'tri-label') => { const t = el('text', { x: f1(x), y: f1(y), 'text-anchor': anchor, class: cls }); t.textContent = text; return t; };
  label(120, 14 - 9, 'middle', 'Weight 900'); label(120, 194 + 13, 'middle', '100', 'tri-label tri-mid');
  label(16 - 4, 194 + 13, 'start', 'Grade +100'); label(172 + 8, 104 + 3.5, 'start', '-100');
  label(224 + 4, 194 + 13, 'end', 'Watch 100');
  const shape = el('polygon', { class: 'tri-shape' });
  AXES.forEach(a => {
    const n = TRI[a].n;
    const h = el('g', { class: `tri-handle ax-${a}`, tabindex: 0, role: 'slider', 'aria-label': TRI[a].name, 'aria-valuemin': AX[a][0], 'aria-valuemax': AX[a][1] });
    el('line', { x1: 0, y1: 0, x2: f1(n[0] * (KNOB - 9)), y2: f1(n[1] * (KNOB - 9)), class: 'tri-lead' }, h);
    el('circle', { r: 2.4, class: 'tri-dot' }, h);
    const knob = el('g', { class: 'tri-knob', transform: `translate(${f1(n[0] * KNOB)} ${f1(n[1] * KNOB)})` }, h);
    el('circle', { r: 9 }, knob);
    el('text', { 'text-anchor': 'middle', dy: 3.6 }, knob).textContent = LETTER[a];
    const val = el('text', { x: f1(n[0] * (KNOB + 15)), y: f1(n[1] * (KNOB + 15) + 3.5), 'text-anchor': n[0] > 0 ? 'start' : 'end', class: 'tri-val' }, h);
    parts[a].h = h; parts[a].val = val;
    h.addEventListener('keydown', e => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
      if (!d) return;
      e.preventDefault();
      if (CL.mono && a !== 'wght') return;
      CL[a] = CL.mono ? (d > 0 ? 700 : 400) : clamp(Math.round(CL[a] + d * (a === 'wght' ? 10 : 2)), AX[a][0], AX[a][1]); drawCard();
      if (CL.mono) loadCard();
    });
  });
  function drawTri() {
    const pts = AXES.map(a => at(a, TRI[a].to(CL[a])));
    shape.setAttribute('points', pts.map(p => p.map(f1).join(',')).join(' '));
    AXES.forEach((a, i) => {
      const [x, y] = pts[i], c = at(a, 1 / 3), off = CL.mono && a !== 'wght', P = parts[a];
      P.fill.setAttribute('x1', f1(c[0])); P.fill.setAttribute('y1', f1(c[1])); P.fill.setAttribute('x2', f1(x)); P.fill.setAttribute('y2', f1(y));
      P.h.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
      P.h.setAttribute('aria-valuenow', Math.round(CL[a]));
      P.h.setAttribute('aria-disabled', off);
      P.h.classList.toggle('tri-off', off); P.track.classList.toggle('tri-off', off); P.fill.classList.toggle('tri-off', off);
      P.val.textContent = `${a} ${signed(a, CL[a])}`;
    });
    tri.classList.toggle('mono', CL.mono);
  }
  // a press on a knob picks it up; a press anywhere else takes the nearest
  // track and moves its knob there; the drag follows along the median
  let dragging = null;
  function svgPoint(e) { const r = tri.getBoundingClientRect(), vb = tri.viewBox.baseVal; return [vb.x + (e.clientX - r.left) / r.width * vb.width, vb.y + (e.clientY - r.top) / r.height * vb.height]; }
  function tOn(a, p) {
    const m = TRI[a].m, v = TRI[a].v, dx = v[0] - m[0], dy = v[1] - m[1];
    return clamp(((p[0] - m[0]) * dx + (p[1] - m[1]) * dy) / (dx * dx + dy * dy), TRI[a].lo, 1);
  }
  function moveTo(a, p) {
    if (CL.mono && a !== 'wght') return;
    const v = clamp(TRI[a].from(tOn(a, p)), AX[a][0], AX[a][1]), was = CL[a];
    CL[a] = CL.mono ? monoW(v) : v; drawCard();
    if (CL.mono && CL[a] !== was) loadCard();          // the other Mono face, before its advance is measured
  }
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const knobAt = a => { const q = at(a, TRI[a].to(CL[a])), n = TRI[a].n; return [q[0] + n[0] * KNOB, q[1] + n[1] * KNOB]; };
  tri.addEventListener('pointerdown', e => {
    const p = svgPoint(e), live = AXES.filter(a => !(CL.mono && a !== 'wght'));
    tri.setPointerCapture(e.pointerId);
    const [dk, byKnob] = live.map(a => [dist(knobAt(a), p), a]).sort((x, y) => x[0] - y[0])[0];
    const a = dk <= 13 ? byKnob : live.map(a => [dist(at(a, tOn(a, p)), p), a]).sort((x, y) => x[0] - y[0])[0][1];
    dragging = a;
    parts[a].h.classList.add('drag');
    parts[a].h.focus({ preventScroll: true });
    if (dk > 13) moveTo(a, p);
  });
  tri.addEventListener('pointermove', e => { if (dragging && tri.hasPointerCapture(e.pointerId)) moveTo(dragging, svgPoint(e)); });
  const drop = () => { if (dragging) parts[dragging].h.classList.remove('drag'); dragging = null; };
  tri.addEventListener('pointerup', drop);
  tri.addEventListener('pointercancel', drop);
  $('#tri-reset').addEventListener('click', () => { Object.assign(CL, { wght: 400, GRAD: 0, WTCH: 0 }); drawCard(); if (CL.mono) loadCard(); });

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
  const crossing = $('#crossing'), sticky = $('.crossing-sticky'), night = $('.face-night'), steel = $('.face-steel');
  // what was last written, so a frame that changes nothing writes nothing
  const wrote = new Map();
  const put = (el, k, v) => {
    if (wrote.get(el.className + k) === v) return;
    wrote.set(el.className + k, v);
    if (k.startsWith('--')) el.style.setProperty(k, v); else el.style[k] = v;
  };
  function onScroll() {
    // every measure first, then every write: a measure after a write made the
    // browser restyle and lay out the page again in the middle of each frame
    const r = crossing.getBoundingClientRect(), nt = night.getBoundingClientRect().top;
    const st = sticky.getBoundingClientRect().top, sh = sticky.offsetHeight, steelTop = steel.getBoundingClientRect().top;
    // the sweep runs while the stage is pinned: over the crossing's height less
    // the stage's (100lvh), which a phone's toolbar does not change; over
    // innerHeight, which it does, the edge jumped as the toolbar slid away
    const p = reduce ? 0.5 : clamp(-r.top / (r.height - sh), 0, 1);
    put(sticky, '--p', p.toFixed(4));
    put(sticky, '--o', Math.max(0, 1 - Math.abs(p - 0.5) * 2.6).toFixed(3));
    // the night half begins under the stage: while the sweep runs, its ground
    // is cut along the edge carried on: the edge's top is at x in the stage,
    // and it runs down-left one for one. The cut is written as the half's own
    // clip-path, not a custom property: those inherit, and every element of
    // the night half was restyled on every frame of the sweep
    if (!reduce) {
      const x = (1 - p) * (innerWidth + sh);
      const c = p < 1 && nt < innerHeight ? (x - (nt - st)).toFixed(1) : '-99999';
      put(night, 'clipPath', `polygon(${c}px 0, 100% 0, 100% 100%, 0 100%, 0 ${c}px)`);
    }
    document.body.classList.toggle('past', r.top + r.height * 0.45 < 0);
    document.body.classList.toggle('steel', steelTop < 44);
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
  leakRow.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; leaking(true); track('survey-fifth-row', 'The survey: its fifth row shown'); } });
  leakRow.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hovering = false; leaking(false); } });
  leakRow.addEventListener('click', () => {
    if (hovering) return;
    track('survey-fifth-row', 'The survey: its fifth row shown');
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

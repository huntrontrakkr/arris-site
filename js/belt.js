/* The Belt's paperwork and its long read.
 *
 * The article: each paragraph is broken into lines once, at the reading
 * weight, and each line is then a block that never wraps; as the page
 * scrolls, a line's weight follows where it stands in the window, Thin
 * near the bottom, filling to the reading weight by the middle, so the
 * text fills in as you reach it without ever reflowing.
 *
 * A film marked data-scrub plays with the scroll, not the clock.
 *
 * In the paragraphs marked data-clue a few letters keep the reading weight
 * whatever their line does. Read them in order while the text is still
 * thin. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const READ = 430, THIN = 100;

  /* ------------------------------------------------------------ paperwork: tap to straighten */
  $$('.desk .doc').forEach(d => d.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const was = d.classList.contains('lift');
    $$('.desk .doc.lift').forEach(o => o.classList.remove('lift'));
    if (!was) d.classList.add('lift');
  }));

  /* ------------------------------------------------------------ torn paper */
  // the clipping is torn along its foot and its right side, the receipt
  // along its foot: a line that wanders at two scales with a fibrous jitter
  // over it, and just outside it a pale rim, the paper's core showing where
  // it tore (css .torn draws both under the text, and the shadow follows
  // them). Seeded, so a tear is the same on every visit; its depths are in
  // pixels, so it keeps its size as the paper's width changes
  function rand(seed) {
    return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  }
  function wander(r, n, every) {
    const knots = Array.from({ length: Math.ceil(n / every) + 2 }, r);
    return i => {
      const t = i / every, k = Math.floor(t), s = (1 - Math.cos((t - k) * Math.PI)) / 2;
      return knots[k] + (knots[k + 1] - knots[k]) * s;
    };
  }
  // n points along an edge, each [the tear's depth, its rim's], in from the box
  function edge(r, n, deep) {
    const big = wander(r, n, 16), mid = wander(r, n, 5);
    return Array.from({ length: n }, (_, i) => {
      const d = Math.max(1.5, deep * (0.3 + 0.7 * big(i)) + deep * 0.45 * (mid(i) - 0.5) + (r() - 0.5) * 2.2);
      return [d, Math.max(0, d - 1 - r() * 2.4)];
    });
  }
  function tear(el, seed, foot, side) {
    const r = rand(seed), F = edge(r, 96, foot), S = side ? edge(r, 64, side) : null;
    const px = v => `${v.toFixed(1)}px`;
    const poly = k => {
      const pts = ['0 0'];
      const right = S ? S[S.length - 1][k] : 0;
      if (S) S.forEach((e, j) => pts.push(`calc(100% - ${px(e[k])}) ${j === S.length - 1 ? `calc(100% - ${px(F[0][k])})` : `${(j / (S.length - 1) * 100).toFixed(2)}%`}`));
      else pts.push('100% 0');
      F.forEach((e, i) => {
        const t = 1 - i / (F.length - 1);
        pts.push(`calc(${(t * 100).toFixed(2)}% - ${px(t * right)}) calc(100% - ${px(e[k])})`);
      });
      return `polygon(${pts.join(', ')})`;
    };
    el.style.setProperty('--tear', poly(0));
    el.style.setProperty('--rim', poly(1));
    el.classList.add('torn');
  }
  const clip = $('.desk .clip'), receipt = $('.desk .receipt');
  if (clip) tear(clip, 7, 13, 7);
  if (receipt) tear(receipt, 11, 6, 0);

  /* ------------------------------------------------------------ the long read */
  const paras = $$('.sheet .taper');
  if (!paras.length) return;
  paras.forEach(p => { p._text = p.textContent.replace(/\s+/g, ' ').trim(); p._marks = new Set(); });

  // spread the message across the clue paragraphs: the i-th letter is the
  // first match at or after the i-th equal share of the text
  const MESSAGE = 'THIRTYFOUR';
  const clue = paras.filter(p => p.hasAttribute('data-clue'));
  const total = clue.reduce((n, p) => n + p._text.length, 0);
  let at = 0;
  [...MESSAGE].forEach((ch, i) => {
    let pos = Math.max(at, Math.floor(i * total / MESSAGE.length + total / MESSAGE.length * 0.3));
    for (;;) {
      let off = pos, k = 0;
      while (k < clue.length && off >= clue[k]._text.length) { off -= clue[k]._text.length; k++; }
      if (k >= clue.length) return;
      if (clue[k]._text[off].toUpperCase() === ch) { clue[k]._marks.add(off); at = pos + 1; return; }
      pos++;
    }
  });

  let lines = [];
  function layout() {
    lines = [];
    paras.filter(p => !p.closest('.sheet').hidden).forEach(p => {
      const words = [...p._text.matchAll(/\S+/g)].map(m => [m.index, m[0]]);
      p.innerHTML = words.map(([, w]) => `<span>${esc(w)}</span>`).join(' ');
      const tops = [...p.children].map(s => s.offsetTop);
      const groups = [];
      words.forEach((w, k) => {
        if (!groups.length || tops[k] > tops[groups[groups.length - 1][0]] + 2) groups.push([k]);
        else groups[groups.length - 1].push(k);
      });
      const mark = (o, w) => [...w].map((c, j) => (p._marks.has(o + j) ? `<b class="k">${esc(c)}</b>` : esc(c))).join('');
      p.innerHTML = groups.map(g => `<span class="tl">${g.map(k => mark(...words[k])).join(' ')}</span>`).join('');
      lines.push(...$$('.tl', p));
    });
    lines.forEach(l => { l._w = -1; });
    update();
  }

  const ease = u => 1 - (1 - u) ** 2;
  function update() {
    const H = innerHeight, lo = H * 0.96, hi = H * 0.52;
    const tops = lines.map(l => l.getBoundingClientRect().top);   // read everything, then write
    lines.forEach((l, i) => {
      const w = Math.round(THIN + (READ - THIN) * ease(clamp((lo - tops[i]) / (lo - hi), 0, 1)));
      if (w !== l._w) { l._w = w; l.style.fontVariationSettings = `"wght" ${w}, "GRAD" 0, "WTCH" 0`; }
    });
  }

  let near = false, queued = false;
  const wrap = $('.sheet-wrap');
  new IntersectionObserver(es => { near = es[0].isIntersecting; if (near) update(); }, { rootMargin: '200px 0px' }).observe(wrap);

  // the next story is a card over the top corner of the one you read (css
  // .next): its head and its summary; turning to it folds the page you read
  // away over its top edge and brings the next up over the same edge into
  // its place, and the card then offers the one you left
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const next = $('#next', wrap), sheets = $$('.sheet', wrap);
  function offer(sheet) {
    const text = sel => $(sel, sheet).textContent.trim();
    $('.next-kicker', next).textContent = text('.sheet-kicker');
    $('.next-hed', next).textContent = text('.sheet-hed');
    $('.next-dek', next).textContent = sheet.dataset.summary || text('.sheet-dek');
    $('.next-n', next).textContent = `${String(sheets.indexOf(sheet) + 1).padStart(2, '0')} / ${String(sheets.length).padStart(2, '0')}`;
    next.setAttribute('aria-label', `Turn to: ${text('.sheet-hed')}`);
  }
  function turn() {
    const from = $('.sheet:not([hidden])', wrap), to = $('.sheet[hidden]', wrap);
    if (!from || !to || wrap.classList.contains('turning')) return;
    const swap = () => {
      from.hidden = true;
      from.classList.remove('fold');
      to.hidden = false;
      offer(from);
      layout();
      if (!still) { to.classList.add('unfold'); to.getBoundingClientRect(); to.classList.remove('unfold'); }
      const top = wrap.getBoundingClientRect().top;
      if (top < 0) scrollBy({ top: top - 40, behavior: still ? 'auto' : 'smooth' });
    };
    if (still) { swap(); return; }
    wrap.classList.add('turning');
    from.classList.add('fold');
    setTimeout(() => { swap(); setTimeout(() => wrap.classList.remove('turning'), 420); }, 340);
  }
  if (next) next.addEventListener('click', turn);
  addEventListener('scroll', () => {
    if (!near || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  let rsz, lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) { update(); return; }       // a phone's toolbar, not a new measure
    lastW = innerWidth; clearTimeout(rsz); rsz = setTimeout(layout, 150);
  });
  document.fonts.ready.then(layout);

  /* ------------------------------------------------------------ films that follow the scroll */
  // the film's time is its place in the window: at the start as it comes up
  // from the bottom, at the end by the time it nears the top; the shown time
  // eases toward that, so the scrub glides rather than steps
  $$('video[data-scrub]').forEach(v => {
    let shown = 0, aim = 0, running = false, near = false;
    const fps = 24;
    function target() {
      const r = v.getBoundingClientRect(), H = innerHeight;
      return clamp((H * 0.95 - r.top) / (H * 0.75), 0, 1) * Math.max(0, (v.duration || 0) - 1 / fps);
    }
    function tick() {
      shown += (aim - shown) * 0.22;
      if (Math.abs(aim - shown) < 0.5 / fps) shown = aim;
      if (Math.abs(v.currentTime - shown) >= 0.5 / fps && !v.seeking) v.currentTime = shown;
      running = shown !== aim;
      if (running) requestAnimationFrame(tick);
    }
    function onScroll() {
      if (!near || !v.duration) return;
      aim = target();
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    new IntersectionObserver(es => {
      near = es[0].isIntersecting;
      if (near && v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
      onScroll();
    }, { rootMargin: '300px 0px' }).observe(v);
    v.addEventListener('loadedmetadata', onScroll);
    addEventListener('scroll', onScroll, { passive: true });
  });
})();

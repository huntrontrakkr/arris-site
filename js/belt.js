/* The Belt's paperwork and its long read.
 *
 * The article: each paragraph is broken into lines once, at the reading
 * weight, and each line is then a block that never wraps; as the page
 * scrolls, a line's weight follows where it stands in the window, Thin
 * near the bottom, filling to the reading weight by the middle, so the
 * text fills in as you reach it without ever reflowing.
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
  $$('.doc').forEach(d => d.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const was = d.classList.contains('lift');
    $$('.doc.lift').forEach(o => o.classList.remove('lift'));
    if (!was) d.classList.add('lift');
  }));

  /* ------------------------------------------------------------ the long read */
  const paras = $$('#sheet-body .taper');
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
    paras.forEach(p => {
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
  const sheet = $('#glasshouse');
  new IntersectionObserver(es => { near = es[0].isIntersecting; if (near) update(); }, { rootMargin: '200px 0px' }).observe(sheet);
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
})();

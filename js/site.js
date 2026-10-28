/* Arris: the site's behaviour. Everything the page states about the font
 * (version, character count, the character set) comes from data/font.json,
 * written from the release by tools/fonts.py. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // the titanium colours: an oxide film thickening, one per weight 100..900
  const TI = ['#a8804c', '#804799', '#4554cc', '#4087e6', '#a8cced', '#f2cc61', '#e67891', '#9e66d1', '#45c7a8'];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function titanium(w) {
    const u = clamp((w - 100) / 800, 0, 1) * 8, i = Math.min(7, Math.floor(u)), f = u - i;
    const a = hex(TI[i]), b = hex(TI[i + 1]);
    return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`;
  }
  const NAMES = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };

  /* ------------------------------------------------------------ the name */
  const mark = $('#mark'), rw = $('#r-wght'), rx = $('#r-wtch');
  function setMark(w, x) {
    w = Math.round(w); x = Math.round(x);
    mark.style.setProperty('--w', w); mark.style.setProperty('--x', x);
    rw.textContent = w; rx.textContent = x;
  }
  let idle = !reduce;
  function point(e) {
    idle = false;
    const r = mark.getBoundingClientRect();
    setMark(100 + 800 * clamp((e.clientX - r.left) / r.width, 0, 1), 100 * clamp((e.clientY - r.top) / r.height, 0, 1));
  }
  mark.addEventListener('pointermove', point);
  mark.addEventListener('pointerdown', point);
  if (idle) {
    const t0 = performance.now();
    // one slow pass from Thin to Black and back, then it rests at Bold
    (function tick(t) {
      if (!idle) return;
      const s = (t - t0) / 1000;
      if (s > 6) { setMark(700, 0); return; }
      setMark(500 - 400 * Math.cos(s / 6 * 2 * Math.PI), 50 - 50 * Math.cos(s / 6 * 2 * Math.PI));
      requestAnimationFrame(tick);
    })(t0);
  }

  /* ------------------------------------------------------------ the watch */
  const watch = $('#watch'), wt = $('#watch-time'), wd = $('#watch-date');
  const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const two = n => String(n).padStart(2, '0');
  let leakUntil = 0;
  function tickWatch() {
    const d = new Date(), now = d.getTime();
    // now and then, for a moment, the watch shows another time
    if (now > leakUntil + 60000 && d.getSeconds() === 47 && Math.random() < 0.34) leakUntil = now + 1400;
    const leaking = now < leakUntil;
    watch.classList.toggle('leaking', leaking);
    wt.textContent = leaking ? '03:47' : `${two(d.getHours())}:${two(d.getMinutes())}`;
    wd.textContent = `${DAYS[d.getDay()]} ${two(d.getDate())}`;
  }
  tickWatch(); setInterval(tickWatch, 250);
  const pixOn = $('#pix-on'), pixOff = $('#pix-off');
  function pixels(on) {
    watch.classList.toggle('pixels', on);
    pixOn.setAttribute('aria-pressed', on); pixOff.setAttribute('aria-pressed', !on);
  }
  pixOn.addEventListener('click', () => pixels(true));
  pixOff.addEventListener('click', () => pixels(false));

  /* ------------------------------------------------------------ one axis at a time */
  const AXES = {
    wght: { label: 'Weight', min: 100, max: 900, value: 400, cls: 'weight',
      note: 'Nine named weights from Thin to Black, and every weight between. Each colour is the shade a titanium oxide film takes as it thickens; here it only ever means weight.' },
    GRAD: { label: 'Grade', min: -100, max: 100, value: -40, cls: 'grade dark',
      note: 'Light text on a dark ground looks heavier than dark on light. Grade thins or thickens every stroke by up to a fifth without moving a single advance: the red outline is grade 0, and the line never changes length, so nothing reflows.' },
    WTCH: { label: 'Watch', min: 0, max: 100, value: 100, cls: 'watch',
      note: "The watch's own stroke balance: at 100, diagonals are as wide across as a stem, as the pixel figures drew them. Arris Watch is this axis at 100." },
  };
  const panel = $('#axis-panel'), range = $('#axis-range'), out = $('#axis-out'), line = $('#axis-line'), ghost = $('#axis-ghost');
  let axis = 'wght';
  const loc = { wght: 400, GRAD: 0, WTCH: 0 };
  function renderAxis() {
    const v = +range.value;
    loc[axis] = v;
    out.textContent = axis === 'wght' ? v : (v > 0 ? '+' : '') + v;
    line.style.setProperty('--aw', axis === 'wght' ? v : (axis === 'GRAD' ? 400 : 600));
    line.style.setProperty('--ag', axis === 'GRAD' ? v : 0);
    line.style.setProperty('--ax', axis === 'WTCH' ? v : 0);
    ghost.style.setProperty('--aw', 400);
    panel.style.setProperty('--aink', axis === 'wght' ? titanium(v) : 'inherit');
    if (axis === 'wght') out.textContent = NAMES[v] ? `${v} ${NAMES[v]}` : v;
  }
  function selectAxis(a) {
    axis = a;
    const A = AXES[a];
    $$('.axis-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.axis === a));
    panel.className = 'axis-panel ' + A.cls;
    $('#axis-label').textContent = A.label;
    range.min = A.min; range.max = A.max; range.value = A.value;
    $('#axis-note').textContent = A.note;
    if (a === 'WTCH') line.textContent = line.textContent === 'Gate 8 closes at 21:47' ? '2,170 · 10:08 · 456' : line.textContent;
    else if (line.textContent === '2,170 · 10:08 · 456') line.textContent = 'Gate 8 closes at 21:47';
    ghost.textContent = line.textContent;
    renderAxis();
  }
  $$('.axis-tabs [role=tab]').forEach(b => b.addEventListener('click', () => selectAxis(b.dataset.axis)));
  $('.axis-tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('.axis-tabs [role=tab]'), i = tabs.findIndex(t => t.dataset.axis === axis);
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); selectAxis(n.dataset.axis);
  });
  range.addEventListener('input', renderAxis);
  line.addEventListener('input', () => { ghost.textContent = line.textContent; });
  selectAxis('wght');

  /* ------------------------------------------------------------ films: play in view */
  const vids = $$('video');
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
    buildSpecimen(f);
  }).catch(() => buildSpecimen(null));

  /* ------------------------------------------------------------ specimen */
  const GROUPS = [
    ['Latin', ['Basic Latin', 'Latin', 'Marks']], ['Cyrillic', ['Cyrillic']], ['Greek', ['Greek']],
    ['Figures', ['Figures', 'Currency', 'Letterlike']], ['Punctuation', ['Punctuation']], ['Arrows', ['Arrows']],
    ['Maths', ['Mathematics', 'Technical']], ['Shapes', ['Shapes', 'Dingbats']], ['Terminal', ['Terminal']], ['Braille', ['Braille']],
  ];
  const canvas = $('#card-canvas'), ctx = canvas.getContext('2d');
  let chars = [], group = null, sel = 0x41;
  const show = c => {
    const ch = String.fromCodePoint(c);
    return /\p{M}/u.test(ch) ? '◌' + ch : ch;
  };

  function buildSpecimen(f) {
    chars = f ? f.chars : [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'].map(ch => [ch.codePointAt(0), '', 'Basic Latin']);
    const g = $('#groups');
    GROUPS.forEach(([name, blocks]) => {
      const n = chars.filter(c => blocks.includes(c[2])).length;
      if (!n) return;
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.group = name;
      b.innerHTML = `${name}<small>${n}</small>`;
      b.addEventListener('click', () => openGroup(name));
      g.appendChild(b);
    });
    openGroup('Latin');
    select(0x41);
  }

  function openGroup(name) {
    group = name;
    $$('#groups button').forEach(b => b.setAttribute('aria-selected', b.dataset.group === name));
    const blocks = GROUPS.find(g => g[0] === name)[1];
    const grid = $('#grid');
    grid.textContent = '';
    const frag = document.createDocumentFragment();
    chars.filter(c => blocks.includes(c[2]) && c[0] > 0x20 && c[0] !== 0xA0).forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.cp = c[0];
      b.textContent = show(c[0]);
      b.title = `U+${c[0].toString(16).toUpperCase().padStart(4, '0')} ${c[1]}`;
      b.setAttribute('aria-selected', c[0] === sel);
      frag.appendChild(b);
    });
    grid.appendChild(frag);
    grid.scrollTop = 0;
  }

  $('#grid').addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(+b.dataset.cp); });
  $('#grid').addEventListener('keydown', e => {
    const keys = { ArrowRight: 1, ArrowLeft: -1 }, bs = $$('#grid button');
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
    const c = chars.find(c => c[0] === cp) || [cp, '', ''];
    $('#card-cp').textContent = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
    $('#card-block').textContent = c[2];
    $('#card-name').textContent = c[1];
    drawCard();
  }

  function drawCard() {
    const ch = show(sel), w = loc.wght;
    const font = `${w} 100px Arris`;
    document.fonts.load(font, ch).then(() => {
      const W = canvas.width = 1000, H = canvas.height = 1000;
      const M = FONT ? FONT.metrics : { upm: 1000, ascender: 975, descender: -250, cap: 720, x: 540 };
      const S = 600, base = 120 + M.ascender / M.upm * S;
      const y = v => base - v / M.upm * S;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 2;
      ctx.font = '22px "Arris Mono", monospace';
      ctx.textBaseline = 'bottom';
      [['ASCENDER', M.ascender], ['CAP HEIGHT', M.cap], ['X-HEIGHT', M.x], ['BASELINE', 0], ['DESCENDER', M.descender]].forEach(([n, v]) => {
        ctx.strokeStyle = v === 0 ? 'rgba(255,176,0,.75)' : 'rgba(241,235,221,.16)';
        ctx.beginPath(); ctx.moveTo(0, y(v)); ctx.lineTo(W, y(v)); ctx.stroke();
        ctx.fillStyle = 'rgba(241,235,221,.45)';
        ctx.fillText(`${n} ${v}`, 6, y(v) - 6);
      });
      ctx.font = `${w} ${S}px Arris`;
      ctx.fillStyle = '#f1ebdd';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(ch);
      ctx.fillText(ch, (W - m.width) / 2, base);
      $('#card-metrics').textContent = `ADVANCE ${Math.round(m.width / S * M.upm)} · wght ${w}`;
    });
  }
  // the card follows the weight chosen above
  range.addEventListener('change', () => { if (axis === 'wght') drawCard(); });

  /* ------------------------------------------------------------ features */
  const FEATS = [
    ['calt', '10:08', "The watch's time colon between figures, on by default", true],
    ['ss20', '10:08', 'Watch pixels: the figures as the watch drew them'],
    ['zero', '2001', 'A slashed zero, its slash square to the corners'],
    ['ss01', '2001', 'A dotted zero'],
    ['ss02', '5 6 5', 'The open five, which blurs least into a 6'],
    ['frac', '1/2 7/8', 'Fractions'],
    ['sups', 'x2 + y2', 'Superiors'],
    ['subs', 'H2O CO2', 'Inferiors'],
    ['case', '(A-Z) [HI]', 'Brackets and dashes raised for capitals'],
    ['pnum', '1110', 'Proportional figures; tabular is the default'],
    ['cv01', 'aaa', 'The single-storey a'],
  ];
  const fl = $('#feat-list');
  FEATS.forEach(([tag, text, what, onByDefault]) => {
    const d = document.createElement('div');
    d.className = 'feat';
    d.innerHTML = '<code></code><span class="off"></span><span class="arrow">→</span><span class="on"></span><span class="what"></span>';
    d.querySelector('code').textContent = tag;
    d.querySelector('.off').style.fontFeatureSettings = onByDefault ? `"${tag}" 0` : 'normal';
    d.querySelector('.on').style.fontFeatureSettings = `"${tag}" 1`;
    d.querySelector('.off').textContent = text; d.querySelector('.on').textContent = text; d.querySelector('.what').textContent = what;
    fl.appendChild(d);
  });

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
  const slice = $('#slice'), leakRow = $('.leak-row');
  if (!reduce && slice) {
    let s = 1, hold = 0;
    setInterval(() => {
      if (hold > 0) { hold--; return; }
      s = s % 33 + 1;
      slice.textContent = two(s);
      leakRow.classList.toggle('on', s === 33);
      if (s === 33) hold = 8;
    }, 180);
  }

  /* ------------------------------------------------------------ copy */
  $('#copy-css').addEventListener('click', e => {
    const t = $('#css-snippet').textContent, b = e.currentTarget;
    navigator.clipboard.writeText(t).then(() => { b.textContent = 'Copied'; }, () => {
      getSelection().selectAllChildren($('#css-snippet')); b.textContent = 'Selected: press Ctrl+C';
    });
    setTimeout(() => { b.textContent = 'Copy CSS'; }, 2400);
  });

  /* ------------------------------------------------------------ for whoever opens the console */
  console.log('%c┌──────────────────────────┐\n│ DOCK 07 · MANIFEST       │\n│ 0347 KAPA      14.2 %  ? │\n│ logged 03:47 · bay 09    │\n└──────────────────────────┘',
    'font-family: "Arris Mono", monospace; color: #3fd6ff; line-height: 1.2');
})();

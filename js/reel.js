/* The reel: five films in one frame. The weight field rests in the middle;
 * the pointer's place across the frame is a place along the row, and the
 * films cross-fade from one to the next as it moves (on a touch screen, a
 * drag across the frame, which then stays where it was let go). A film is
 * fetched when the pointer first comes near it, and only the films showing
 * play. The names under the frame choose one outright. With reduced motion
 * nothing plays: the films' stills pass instead. */
(() => {
  const reel = document.getElementById('reel');
  if (!reel) return;
  const stage = reel.querySelector('.reel-stage'), rail = reel.querySelector('.reel-rail');
  const stops = [...reel.querySelectorAll('.reel-stop')], home = stops.findIndex(b => 'home' in b.dataset);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const vids = stops.map((b, i) => {
    if (i === home) return stage.querySelector('video');
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.poster = b.dataset.poster; v.dataset.src = b.dataset.src; v.setAttribute('aria-label', b.dataset.label);
    v.style.opacity = 0;
    stage.appendChild(v);
    return v;
  });
  let p = home, aim = home, held = null, raf = 0, inView = false, dragging = false;
  function show() {
    vids.forEach((v, i) => {
      const o = Math.max(0, 1 - Math.abs(p - i));
      v.style.opacity = o.toFixed(3);
      v.style.zIndex = o > 0.5 ? 1 : 0;
      if (o > 0 && v.dataset.src) { v.src = v.dataset.src; delete v.dataset.src; }
      const play = o > 0.02 && inView && !still.matches;
      if (play && v.paused) v.play().catch(() => {}); else if (!play && !v.paused) v.pause();
    });
    const near = Math.round(p);
    stops.forEach((b, i) => b.setAttribute('aria-pressed', i === near));
    rail.style.setProperty('--reel-p', p.toFixed(3));
  }
  function step() {
    raf = 0;
    p += (aim - p) * 0.14;
    if (Math.abs(aim - p) < 0.002) p = aim;
    show();
    if (p !== aim) raf = requestAnimationFrame(step);
  }
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  const across = e => { const r = stage.getBoundingClientRect(); return Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width - 0.07) / 0.86)) * (stops.length - 1); };   // (the ends' films whole a little before the edge)
  stage.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { held = null; aim = across(e); go(); }
    else if (dragging) { aim = across(e); go(); }
  });
  stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { dragging = true; aim = across(e); go(); } });
  const settle = e => {
    if (e.pointerType === 'mouse') { if (e.type === 'pointerleave') { aim = held ?? home; go(); } return; }
    if (dragging) { dragging = false; aim = held = Math.round(aim); go(); }
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) stage.addEventListener(ev, settle);
  stops.forEach((b, i) => b.addEventListener('click', () => { aim = held = i; go(); }));
  new IntersectionObserver(es => { inView = es[0].isIntersecting; show(); }, { threshold: 0.35 }).observe(stage);
  show();
})();

/* The reel beside the weight field: more short films, small, to choose
 * from. Choosing one puts it in the player, which plays and pauses with
 * the page as before (site.js); a film loads only when it is chosen. */
(() => {
  const reel = document.getElementById('reel');
  if (!reel) return;
  const video = reel.querySelector('video'), items = [...reel.querySelectorAll('.reel-item')];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  items.forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    items.forEach(x => x.setAttribute('aria-pressed', x === b));
    video.pause();
    video.poster = b.dataset.poster;
    video.setAttribute('aria-label', b.dataset.label);
    video.querySelector('source').src = b.dataset.src;
    video.load();
    if (!still.matches) video.play().catch(() => {});
  }));
})();

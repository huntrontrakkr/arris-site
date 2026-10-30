/* Arris Mono on the page: an editable code window in five languages, the
 * ligature board, and a live terminal. The ligatures listed here are the
 * ones the 1.002 Mono forms (each checked with HarfBuzz against the release:
 * calt on and off shape differently); "never" are sequences it leaves alone. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ samples (the deck's, verbatim) */
  const SAMPLES = [
    { file: 'relay.rs', lang: 'rs', code:
`// count the relay chatter, set in Arris Mono
use std::collections::HashMap;

fn tally(packets: &[&str]) -> HashMap<&str, usize> {
    let mut seen = HashMap::new();
    for p in packets.iter().filter(|p| p.len() >= 3) {
        *seen.entry(p).or_insert(0) += 1;
    }
    seen
}

const armed = (ice, key) => ice !== key && key <= 0xFF;
let sectors = 0..=9; /* inclusive */
shards |> map(decrypt) |> filter(clean)   -- key <$> shards <*> ice
if node != home || id == "#{handle}" { return node -> home }` },
    { file: 'burns.py', lang: 'py', code:
`# burns.py
from dataclasses import dataclass

@dataclass(frozen=True)
class Burn:
    body: str
    delta_v: float   # km/s

def cheapest(bs: list[Burn]) -> Burn | None:
    return min(bs, key=lambda b: b.delta_v, default=None)

costly = [b for b in burns if b.delta_v >= 3.0 and b.body != "Luna"]
print(f"{len(costly)} of {len(burns)} burns at 3 km/s or more")
assert 2 ** 10 == 1_024   # ints stay exact` },
    { file: 'Uplink.tsx', lang: 'ts', code:
`// Uplink.tsx
import { useMemo } from "react";

type Props = { pings?: number; handle: string };

export const Uplink = ({ pings = 0, handle }: Props) => {
  const text = useMemo(() => (pings > 99 ? "99+" : String(pings)), [pings]);
  if (pings === 0 && !handle) return null;
  return (
    <section className="uplink" aria-live="polite">
      <span>{handle}</span>
      <b hidden={pings !== 0 ? undefined : true}>{text}</b>
      <hr />
    </section>
  );
};` },
    { file: 'reactor.ex', lang: 'ex', code:
`defmodule Reactor do
  @spec mean([number]) :: float
  def mean(core_temps) do
    core_temps
    |> Enum.reject(&is_nil/1)
    |> Enum.map(fn r -> r * 1.0 end)
    |> then(&(Enum.sum(&1) / length(&1)))
  end
end

IO.puts("core: #{Reactor.mean([621, nil, 623])}")` },
    { file: 'Cargo.hs', lang: 'hs', code:
`module Main where

parse :: String -> Maybe Int
parse = readMaybe

tonnage :: [String] -> Maybe Int
tonnage xs = sum <$> traverse parse xs

pair = (,) <$> Just 1 <*> Just 2
main = print (tonnage ["3000", "470"])` },
  ];

  const KW = {
    rs: 'use fn let mut for in if return const struct impl match pub',
    py: 'from import class def return for in if and or not lambda None True False assert',
    ts: 'import from type export const if return null undefined true false',
    ex: 'defmodule do def end fn nil',
    hs: 'module where let in case of',
  };
  const COMMENT = {
    rs: String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/|-- [^\n]*`, ts: String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`,
    py: String.raw`#[^\n]*`, ex: String.raw`#[^{\n][^\n]*`, hs: String.raw`--[^\n]*`,
  };
  const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function highlight(code, lang) {
    const kw = new Set(KW[lang].split(' '));
    const re = new RegExp(`(${COMMENT[lang]})|("(?:\\\\.|[^"\\\\])*")|(@\\w+)|\\b(0x[0-9A-Fa-f]+|\\d[\\d_]*(?:\\.\\d+)?)\\b|\\b([A-Za-z_]\\w*)\\b`, 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      const [t, cm, st, at, nu, w] = m;
      let cls = cm ? 'cm' : st ? 'st' : at ? 'fn' : nu ? 'nu' : '';
      if (w) cls = kw.has(w) ? 'kw' : /^[A-Z]/.test(w) || ['str', 'usize', 'float', 'list', 'number', 'string'].includes(w) ? 'ty' : code[re.lastIndex] === '(' ? 'fn' : '';
      out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  /* ------------------------------------------------------------ the editor */
  const editor = $('#editor'), codeEl = $('#ed-code'), nums = $('#ed-nums'), tabs = $('#ed-tabs');
  let current = 0;
  const edited = SAMPLES.map(s => s.code);

  function caretOffset() {
    const sel = getSelection();
    if (!sel.rangeCount || !codeEl.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0).cloneRange();
    r.selectNodeContents(codeEl); r.setEnd(sel.anchorNode, sel.anchorOffset);
    return r.toString().length;
  }
  function setCaret(n) {
    const w = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = w.nextNode())) {
      if (n <= node.length) { const r = document.createRange(); r.setStart(node, n); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
      n -= node.length;
    }
  }
  function render(keepCaret) {
    const text = codeEl.textContent, at = keepCaret ? caretOffset() : null;
    codeEl.innerHTML = highlight(text, SAMPLES[current].lang);
    nums.textContent = text.split('\n').map((_, i) => i + 1).join('\n');
    if (at != null) setCaret(at);
  }
  function open(i) {
    edited[current] = codeEl.textContent || edited[current];
    current = i;
    [...tabs.children].forEach((b, k) => b.setAttribute('aria-selected', k === i));
    codeEl.textContent = edited[i];
    render(false);
  }
  SAMPLES.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = s.file;
    b.addEventListener('click', () => open(i));
    tabs.appendChild(b);
  });
  codeEl.textContent = edited[0];
  open(0);
  let timer;
  codeEl.addEventListener('input', () => {
    nums.textContent = codeEl.textContent.split('\n').map((_, i) => i + 1).join('\n');
    clearTimeout(timer); timer = setTimeout(() => render(true), 500);
  });
  codeEl.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '    '); }
  });

  const toggles = { 't-calt': ['no-calt', true], 't-ss03': ['ss03', false], 't-cells': ['cells', false], 't-bold': ['bold', false], 't-ital': ['ital', false] };
  Object.entries(toggles).forEach(([id, [cls, inverse]]) => {
    const b = $('#' + id);
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      editor.classList.toggle(cls, inverse ? !on : on);
    });
  });

  /* ------------------------------------------------------------ the ligature board */
  const LIGS = [
    ['Arrows', '-> --> <- <-> => ==> <=> |-> <-| |=> ->> <<- ~> ~~> <~ <!--'],
    ['Equality', '== === != !== /= =/= := =: ::='],
    ['Comparison', '<= >='],
    ['Tags and pipes', '</ /> </> <> |> <| <|> ||> <||'],
    ['Functional', '<$> <$ $>'],
    ['Hash', '#{ #[ #( #_'],
    ['Dashes', '-- ++'],
  ];
  const ligs = $('#ligs');
  LIGS.forEach(([name, list]) => {
    const g = document.createElement('div');
    g.className = 'lig-group'; g.textContent = name;
    ligs.appendChild(g);
    list.split(' ').forEach(seq => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lig';
      b.setAttribute('aria-label', `${seq}: ${seq.length} cells`);
      b.innerHTML = '<span class="lig-sign"><span class="lig-raw" aria-hidden="true"></span></span><span class="lig-chars"></span>';
      b.querySelector('.lig-sign').prepend(seq);
      b.querySelector('.lig-raw').textContent = seq;
      b.querySelector('.lig-chars').textContent = seq.split('').join(' ');
      b.addEventListener('click', () => b.classList.toggle('show'));
      ligs.appendChild(b);
    });
  });
  $('#never').textContent = '<=<  >>=  //=  ||=  ---->  ::  //  ||';

  /* ------------------------------------------------------------ the terminal: the Glasshouse's console */
  // The module from the long read above, as its night-shift console: a
  // status line in Powerline segments, panes of box drawing with sparklines
  // in blocks and graphs in Braille, a log that ticks over, and a prompt.
  // The frame is laid out to the width it has: panes side by side where
  // there is room for them, stacked where there is not.
  const tui = $('#tui');
  const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', SPARK = '▁▂▃▄▅▆▇█', BRAILLE = '⣀⣄⣤⣦⣶⣷⣿';
  const two = n => String(n).padStart(2, '0');
  const seg = (t, c = '') => [t, c];
  const cells = t => [...t].length;
  const html = row => row.map(([t, c]) => (c ? `<span class="${c}">${esc(t)}</span>` : esc(t))).join('');
  const fit = (row, n) => {                          // a row cut or padded to n cells
    const out = []; let used = 0;
    for (const [t, c] of row) {
      const ch = [...t];
      if (used + ch.length <= n) { out.push([t, c]); used += ch.length; }
      else { out.push([ch.slice(0, n - used).join(''), c]); used = n; break; }
    }
    if (used < n) out.push(seg(' '.repeat(n - used)));
    return out;
  };
  const wave = (k, n, f, lo = 0) => [...Array(n)].map((_, i) => Math.max(lo, Math.min(1, f((k - n + i) / 6) * 0.5 + 0.5)));
  const spark = (k, n, f, cls) => seg(wave(k, n, f).map(v => SPARK[Math.round(v * 7)]).join(''), cls);
  const braille = (k, n, f, cls) => seg(wave(k, n, f).map(v => BRAILLE[Math.round(v * 6)]).join(''), cls);
  const bar = (share, n) => { const f = Math.round(share * n * 8), full = Math.floor(f / 8), part = f % 8; return '█'.repeat(full) + (part ? ' ▏▎▍▌▋▊▉'[part] : '') + ' '.repeat(Math.max(0, n - full - (part ? 1 : 0))); };
  // a pane: rows in a frame w cells wide, titled; the active one heavy
  function pane(title, rows, w, heavy = false) {
    const [tl, tr, bl, br, h, v] = heavy ? '┏┓┗┛━┃' : '╭╮╰╯─│';
    const iw = w - 2;
    const head = [seg(tl + h + ' '), seg(title, heavy ? 'p1f' : 'dim'), seg(' ' + h.repeat(Math.max(0, iw - cells(title) - 3)) + tr)];
    return [fit(head, w), ...rows.map(r => [seg(v), ...fit(r, iw), seg(v)]), [seg(bl + h.repeat(iw) + br)]];
  }
  const beside = (a, b) => a.map((r, i) => [...r, seg(' '), ...b[i]]);
  // the log: the night shift's entries, one more every few seconds
  const LOG = [
    ['02:51', 'lamps -> amber, 20 min ramp', ''],
    ['02:58', 'bed 7 watered, 14 L', 'ok'],
    ['03:04', 'east window: condensation >= 2 mm, wiper on', ''],
    ['03:11', 'T. log: "thorns true, flowers on their own time"', 'dim'],
    ['03:19', 'hal: last row, 6 L', 'ok'],
    ['03:26', 'lamps -> off; corridor light only', ''],
    ['03:40', 'bladder 3 sealed, 212 L left, next lift 06:00', ''],
    ['03:52', 'air 21.4 C, rh 58 %, co2 612 ppm: within band', 'ok'],
    ['04:10', 'east bed: first bloom, dark red', 'p1f'],
    ['04:14', 'M. log: "do not water them more"', 'dim'],
  ];
  let k = 0, cols = 0;
  function frame() {
    const w = cols, wide = w >= 84;
    const d = new Date(), m26 = Math.floor((d.getHours() * 60 + d.getMinutes()) * 26 / 24) % (26 * 60);
    // the status line
    const left = [seg(' ⌂ glasshouse ', 'p1'), seg('', 'p1f p2'), seg(' ring 4 · night shift ', 'p2'), seg('', 'p2f'), seg(' 3 panes ', 'dim')];
    const right = [seg('', 'p3'), seg(` ${two(Math.floor(m26 / 60))}:${two(m26 % 60)} `, 'p3'), seg(' 26h ', 'dim'), seg('✓ ', 'ok')];
    const status = [...left, seg(' '.repeat(Math.max(1, w - left.concat(right).reduce((n, [t]) => n + cells(t), 0)))), ...right];
    // the panes
    const pw = wide ? Math.floor((w - 1) / 2) : w, iw = pw - 2, g = iw - 16;
    const air = (21.4 + 0.3 * Math.sin(k / 40)).toFixed(1), rh = Math.round(58 + 2 * Math.sin(k / 60)), co2 = Math.round(612 + 9 * Math.sin(k / 50));
    const ramp = Math.min(1, (k % 400) / 300), lit = Math.round(ramp * 8);
    const env = pane('env', [
      [seg(` air   ${air} °C  `), spark(k, g, x => Math.sin(x), 'w9')],
      [seg(` rh    ${rh} %     `), spark(k, g, x => Math.sin(x / 1.7 + 1), 'w4')],
      [seg(` co2   ${co2} ppm  `), braille(k, g, x => Math.sin(x / 2.3) * Math.cos(x / 5), 'w4')],
      [seg(' light '), seg('░▒▓█'.repeat(2).slice(0, lit), 'w6'), seg(' '.repeat(8 - lit)), seg(ramp < 1 ? '  ramping to amber' : '  amber', ramp < 1 ? 'dim' : 'p1f')],
    ], pw);
    const sec = Math.floor(k / 4) % 900, bw = Math.max(6, iw - 24);
    const water = pane('water', [
      [seg(' bladder '), seg(bar(212 / 340, bw), 'w4'), seg(' 212/340 L')],
      [seg(` bed 7   ▶ watering ${SPIN[k % 10]} `), seg(`${two(Math.floor(sec / 60))}:${two(sec % 60)}`, 'p1f')],
      [seg(' east    '), seg('✓ done 02:58', 'ok'), seg('   14 L')],
      [seg(' pH      6.3     '), spark(k, g, x => Math.sin(x / 3) * 0.3, 'w9')],
    ], pw, true);
    const n = wide ? 6 : 5, at = n - 1 + Math.floor(k / 24);      // full from the first frame, then one more every six seconds
    const log = pane('log', [...Array(n)].map((_, i) => {
      const e = LOG[(at + i - n + 1) % LOG.length];
      return [seg(` ${e[0]}  `, 'dim'), seg(e[1], e[2])];
    }), w);
    const cmd = w >= 70 ? './water --bed 7 --litres 14 && ./lamps --ramp 20m -> amber' : './water --bed 7 -l 14 && ./lamps -> amber';
    const prompt = [seg(' ❯ ', 'p1f'), seg(cmd), seg(k % 4 < 2 ? '▌' : ' ', 'p1f')];
    const rows = [fit(status, w), ...(wide ? beside(env, water) : [...env, ...water]), ...log, fit(prompt, w)];
    tui.innerHTML = rows.map(html).join('\n');
    k++;
  }
  // the width in cells, from a measured character
  function measure() {
    const probe = document.createElement('span'); probe.textContent = 'M'.repeat(20); probe.style.position = 'absolute'; probe.style.visibility = 'hidden';
    tui.appendChild(probe);
    const cell = probe.getBoundingClientRect().width / 20; probe.remove();
    const cs = getComputedStyle(tui);
    const c = Math.max(40, Math.floor((tui.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / cell) - 1);
    if (c !== cols) { cols = c; frame(); }
  }
  document.fonts.ready.then(measure);
  measure();
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(tui);
  if (!reduce) {
    let vis = false;
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(tui);
    setInterval(() => { if (vis && cols) frame(); }, 250);
  }
})();

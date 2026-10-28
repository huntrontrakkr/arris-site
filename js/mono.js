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

  const toggles = { 't-calt': ['no-calt', true], 't-ss03': ['ss03', false], 't-cells': ['cells', false], 't-bold': ['bold', false] };
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

  /* ------------------------------------------------------------ the terminal */
  const tui = $('#tui'), W = 46, L = 14;
  const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', SPARK = '▁▂▃▄▅▆▇█', BR = '⣀⣤⣶⣿⣿⣷⣦⣄⡀⢀⣠⣴⣾⣿⣷⣦⣤⣀';
  const two = n => String(n).padStart(2, '0');
  // a row is a list of [text, class]; the frame pads the text to its width
  const seg = (t, c = '') => [t, c];
  const html = row => row.map(([t, c]) => (c ? `<span class="${c}">${esc(t)}</span>` : esc(t))).join('');
  const len = row => row.reduce((n, [t]) => n + [...t].length, 0);
  const pad = (row, n) => [...row, seg(' '.repeat(Math.max(0, n - len(row))))];
  const full = row => [seg('│'), ...pad(row, W - 2), seg('│')];
  const split = (a, b) => [seg('│'), ...pad(a, L), seg('│'), ...pad(b, W - L - 3), seg('│')];
  let k = 0;
  function frame() {
    const d = new Date(), pct = Math.floor(k / 2) % 101, filled = Math.round(pct / 100 * 26);
    const bar = '█'.repeat(filled) + ' '.repeat(26 - filled);
    const cpu = [...Array(8)].map((_, i) => SPARK[Math.floor((Math.sin((k + i * 3) / 5) * 0.5 + 0.5) * 7.99)]).join('');
    const net = [...BR].map((_, i) => BR[(i + k) % BR.length]).join('');
    const rows = [
      [seg('  main ', 'p1'), seg('', 'p1f p2'), seg(' ~/code/arris-type ', 'p2'), seg('', 'p2f'), seg('  make proofs  '),
        seg('', 'p3'), seg(` ${two(d.getHours())}:${two(d.getMinutes())} `, 'p3'), seg('', 'p3'), seg(' ✓', 'ok')],
      [seg('╭─┤ Arris Mono ├' + '─'.repeat(W - 17) + '╮')],
      full([seg(` build ${SPIN[k % 10]}  ▕`), seg(bar, 'w4'), seg(`▏${String(pct).padStart(4)}%`)]),
      full([seg(' tests    '), seg('✓ 4 passed', 'ok'), seg('  ✗ 0 failed  '), seg('⚠ 1', 'p3')]),
      [seg('├' + '─'.repeat(L) + '┬' + '─'.repeat(W - L - 3) + '┤')],
      split([seg(' cpu '), seg(cpu, 'w9')], [seg(' '), seg(net, 'w4'), seg(' net '), seg('░▒▓█', 'dim')]),
      split([seg(' mem ████▋')], [seg(' ◆ fonts  ● vf  ○ docs  ★ ok')]),
      [seg('├' + '─'.repeat(L) + '┼' + '─'.repeat(W - L - 3) + '┤')],
      split([seg(' ▶ '), seg('Thin', 'w1')], [seg(' ┏━━━━━━━━┓ ╔════════╗ ┌┄┄┄┐')]),
      split([seg(' ▷ '), seg('Regular', 'w4')], [seg(' ┃ heavy  ┃ ║ double ║ ┆   ┆')]),
      split([seg(' ▸ '), seg('Black', 'w9')], [seg(' ┗━━━━━━━━┛ ╚════════╝ └┄┄┄┘')]),
      [seg('╰' + '─'.repeat(L) + '┴' + '─'.repeat(W - L - 3) + '╯')],
      [seg(' ☐ todo ☑ done ☒ dropped ☰ menu ♫ ⚙ ⚡ ➜ ⬆ ⬇', 'dim')],
    ];
    tui.innerHTML = rows.map(html).join('\n');
    k++;
  }
  frame();
  if (!reduce) {
    let vis = false;
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(tui);
    setInterval(() => { if (vis) frame(); }, 110);
  }
})();

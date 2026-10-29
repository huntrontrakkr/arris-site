"""Write data/transfer.json: how a figure on the watch became a letter.

For each pair (a figure, and a letter that reuses one of its moves) this
takes the pixel masters and the Chamfer rule from an arris-type checkout
(arris.heritage, arris.masters) and lays them on the site's own variable
font (fonts/arris.woff2) at the watch's weight, wght 600 and WTCH 100,
where Arris draws the figures as the watch does. Everything is in font
units, y down for SVG, each glyph from its own origin:

  rows    the pixel master, top row first ('#' lit), each pixel a module
          (60 units) square
  cut     what the rule takes off: every exposed corner, at 45 degrees
  fill    what it adds: every inside step, filled on the same diagonal
  rule    the outline that leaves
  box     the master's grid: x, y, columns, rows, module

and it prints how far each glyph in the font sits from the rule's outline.

usage: uv run --project ../arris-type python tools/transfer.py ../arris-type
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import shapely
import shapely.affinity
from shapely.geometry import Polygon, box
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(sys.argv[1]).resolve() / 'src'))
from arris import heritage, masters  # noqa: E402

M = 60                    # a module in font units: 720 / 12 rows, 540 / 9
WATCH = {'wght': 600, 'WTCH': 100, 'GRAD': 0}
# (figure, letter, the move, every letter that makes it, what Arris changed
# from the rule's outline, if anything: docs/DESIGN.md sections 2 and 3)
PAIRS = [
    ('2', 'Z', 'the notch', 'Z z X', ''),
    ('3', 'B', 'the waist', 'B ß', 'The B’s upper bowl is a module narrower, after the legibility tests.'),
    ('5', 'S', 'the beaks', 'C G J S c j ?', ''),
    ('0', 'O', 'the bowls', 'B C D G O P Q R S U b d g o p q', ''),
    ('7', 'N', 'the 2:1 stroke', 'N v w / ⁄', 'The staircases are straightened into one 2:1 stroke each, as the watch straightened its 7.'),
]


def master(ch):
    """(rows, the master's baseline row from the bottom)"""
    if ch.isdigit():
        return heritage.zone(ch), 0
    if ch in masters.CAPS:
        return masters.CAPS[ch], 0
    return masters.LOWER[ch], masters.DESC


def outline(gs, name):
    """the glyph's ink as a shapely geometry, y up"""
    pen = RecordingPen()
    gs[name].draw(pen)
    rings, ring = [], []
    for op, args in pen.value:
        if op == 'moveTo':
            ring = [args[0]]
        elif op == 'lineTo':
            ring.append(args[0])
        elif op in ('qCurveTo', 'curveTo'):
            ring.extend(args)          # the upright at the watch has no curves; keep the points if any
        elif op in ('closePath', 'endPath'):
            if len(ring) > 2:
                rings.append(Polygon(ring).buffer(0))
            ring = []
    ink = shapely.Polygon()
    for r in sorted(rings, key=lambda p: -p.area):    # even-odd: counters cut their bowls
        ink = ink.symmetric_difference(r)
    return ink


def svg(geom, nd=1):
    """an SVG path, y flipped down"""
    out = []
    polys = [geom] if geom.geom_type == 'Polygon' else list(getattr(geom, 'geoms', []))
    for p in polys:
        if p.geom_type != 'Polygon' or p.is_empty:
            continue
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)[:-1]
            out.append('M' + 'L'.join(f'{round(x, nd):g} {round(-y, nd):g}' for x, y in pts) + 'Z')
    return ''.join(out)


def main():
    vf = TTFont(SITE / 'fonts' / 'arris.woff2')
    st = instancer.instantiateVariableFont(vf, WATCH)
    gs, cmap, hmtx = st.getGlyphSet(), st.getBestCmap(), st['hmtx']
    out = {'module': M, 'watch': WATCH, 'pairs': []}
    for fig, let, move, where, note in PAIRS:
        glyphs = []
        for ch in (fig, let):
            rows, base = master(ch)
            H, W = len(rows), len(rows[0])
            rule = heritage.trace(rows)
            px = shapely.union_all([box(x, H - y - 1, x + 1, H - y) for y in range(H) for x in range(W) if rows[y][x] == '#'])
            name = cmap[ord(ch)]
            ink = outline(gs, name)
            # the master's module grid on the glyph: scaled, its baseline on the font's,
            # its left edge where the glyph's ink begins
            dx = ink.bounds[0] - rule.bounds[0] * M

            def to_font(g):
                return shapely.affinity.translate(shapely.affinity.scale(g, M, M, origin=(0, 0)), dx, -base * M)
            rule_f, px_f = to_font(rule), to_font(px)
            off = rule_f.symmetric_difference(ink).area / rule_f.area
            print(f'{ch}: font vs the rule, {off:.2%} of the ink differs', file=sys.stderr)
            glyphs.append({
                'ch': ch, 'adv': hmtx[name][0], 'rows': rows,
                'box': [round(dx, 1), -(H - base) * M, W, H, M],
                'cut': svg(px_f.difference(rule_f)), 'fill': svg(rule_f.difference(px_f)),
                'rule': svg(rule_f), 'off': round(off, 4),
            })
        out['pairs'].append({'move': move, 'where': where, 'note': note, 'glyphs': glyphs})
    (SITE / 'data' / 'transfer.json').write_text(json.dumps(out, separators=(',', ':')) + '\n')
    print(f"wrote data/transfer.json, {len(out['pairs'])} pairs", file=sys.stderr)


if __name__ == '__main__':
    main()

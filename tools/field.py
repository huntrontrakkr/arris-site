"""The outlines the live field draws (js/field.js): a few glyphs of the
site's own variable font at every 50 of weight, so the page can set any
weight, or a weight for every point, between them (the font is linear
between its masters, which stand no closer than 50).

Writes data/field.json: {weights, glyphs: {ch: {ends, adv: [per weight],
pts: [per weight: x0, y0, x1, y1, ...]}}}, font units, y up. Upright
glyphs only: their outlines are straight lines (every point on the curve).

usage: python3 tools/field.py         (after tools/fonts.py)
"""
from __future__ import annotations

import json
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.iup import iup_delta
from fontTools.varLib.models import normalizeLocation, supportScalar

ROOT = Path(__file__).resolve().parent.parent
CHARS = '8ARgs&ak'
WEIGHTS = list(range(100, 901, 50))


def main() -> None:
    tt = TTFont(ROOT / 'fonts' / 'arris.woff2')
    axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in tt['fvar'].axes}
    glyf, hmtx, gvar, cmap = tt['glyf'], tt['hmtx'].metrics, tt['gvar'], tt.getBestCmap()
    out = {'weights': WEIGHTS, 'upm': tt['head'].unitsPerEm, 'cap': tt['OS/2'].sCapHeight, 'glyphs': {}}
    for ch in CHARS:
        name = cmap[ord(ch)]
        g = glyf[name]
        assert g.numberOfContours > 0 and all(f & 1 for f in g.flags), f'{ch}: an outline of straight lines is wanted'
        coords, ctrl = glyf._getCoordinatesAndControls(name, hmtx, None)
        base = [tuple(c) for c in coords]
        advs, pts = [], []
        for w in WEIGHTS:
            loc = normalizeLocation({'wght': w}, axes)
            at = [list(c) for c in base]
            for tv in gvar.variations.get(name, ()):
                s = supportScalar(loc, tv.axes)
                if not s:
                    continue
                d = tv.coordinates
                if None in d:
                    d = iup_delta(d, base, ctrl.endPts)
                for q, (dx, dy) in zip(at, d):
                    q[0] += s * dx
                    q[1] += s * dy
            advs.append(round(at[-3][0] - at[-4][0]))
            pts.append([round(v) for q in at[:-4] for v in q])
        out['glyphs'][ch] = {'ends': list(g.endPtsOfContours), 'adv': advs, 'pts': pts}
    path = ROOT / 'data' / 'field.json'
    path.write_text(json.dumps(out, separators=(',', ':')))
    print(f'{path.relative_to(ROOT)}: {len(CHARS)} glyphs at {len(WEIGHTS)} weights, {path.stat().st_size / 1e3:.1f} kB')


if __name__ == '__main__':
    main()

"""The site's fonts, from a release zip: the variable fonts split by script
so a page in Latin loads a small file, and the rest of the character set
arrives only when a character from it is on the page.

  latin    ASCII, Latin-1 and the punctuation, figures, arrows and signs an
           English page sets (about 250 characters): all three axes, every
           feature, for the first paint
  rest     the full variable font, served for every code point outside latin
           (CSS unicode-range), so Cyrillic, Greek, symbols and the terminal
           set load on demand

Also copies every Mono and Mono Narrow weight the release carries (Light
to Bold, with Retina, each upright and italic) whole, writes data/font.json (version,
axes, features, code points with their Unicode names and blocks) and the
@font-face rules to css/fonts.css.

usage: python3 tools/fonts.py Arris-1.005.zip
       python3 tools/fonts.py --mono DIR     (Mono alone, from built TTFs: ArrisMono-*.ttf in DIR,
                                               ahead of a release; the variable fonts stay as they are)
"""
from __future__ import annotations

import io
import json
import shutil
import sys
import unicodedata
import zipfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONTS, DATA, CSS = ROOT / 'fonts', ROOT / 'data', ROOT / 'css'

LATIN = [(0x0020, 0x007E), (0x00A0, 0x00FF), (0x0131, 0x0131), (0x0152, 0x0153), (0x2010, 0x2027),
         (0x2030, 0x203A), (0x2070, 0x2079), (0x2080, 0x2089), (0x20AC, 0x20AC), (0x2122, 0x2122),
         (0x2190, 0x2199), (0x2212, 0x2212), (0x2215, 0x2215), (0x2260, 0x2265), (0x25A0, 0x25A1),
         (0x2702, 0x2702)]


def ranges(cps):
    out, cps = [], sorted(cps)
    for c in cps:
        if out and c == out[-1][1] + 1:
            out[-1][1] = c
        else:
            out.append([c, c])
    return out


def css_range(rs):
    return ', '.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in rs)


def save_subset(font_bytes, cps, path):
    f = TTFont(io.BytesIO(font_bytes))
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True        # the cut-corner .notdef is part of the face
    opts.flavor = 'woff2'
    s = subset.Subsetter(opts)
    s.populate(unicodes=cps)
    s.subset(f)
    f.save(path)
    return path.stat().st_size


BLOCKS = [(0x0000, 0x007F, 'Basic Latin'), (0x0080, 0x024F, 'Latin'), (0x0250, 0x02FF, 'Latin'),
          (0x0300, 0x036F, 'Marks'), (0x0370, 0x03FF, 'Greek'), (0x0400, 0x052F, 'Cyrillic'),
          (0x1E00, 0x1EFF, 'Latin'), (0x1F00, 0x1FFF, 'Greek'), (0x2000, 0x206F, 'Punctuation'),
          (0x2070, 0x209F, 'Figures'), (0x20A0, 0x20CF, 'Currency'), (0x2100, 0x218F, 'Letterlike'),
          (0x2190, 0x21FF, 'Arrows'), (0x2200, 0x22FF, 'Mathematics'), (0x2300, 0x23FF, 'Technical'),
          (0x2400, 0x24FF, 'Technical'), (0x2500, 0x259F, 'Terminal'), (0x25A0, 0x25FF, 'Shapes'),
          (0x2600, 0x27BF, 'Dingbats'), (0x27C0, 0x27FF, 'Mathematics'), (0x2800, 0x28FF, 'Braille'),
          (0x2900, 0x2BFF, 'Arrows'), (0x2C60, 0x2C7F, 'Latin'), (0xA720, 0xA7FF, 'Latin'),
          (0xE000, 0xF8FF, 'Terminal'), (0xFB00, 0xFB4F, 'Latin')]


def block(c):
    for a, b, n in BLOCKS:
        if a <= c <= b:
            return n
    return 'Other'


# Mono's weights, by the style names its files carry (the release's web/ and the build's TTFs)
MONO = {'Thin': 100, 'ExtraLight': 200, 'Light': 300, 'Regular': 400, 'Retina': 450, 'Medium': 500,
        'SemiBold': 600, 'Bold': 700, 'ExtraBold': 800, 'Black': 900}


def mono_styles(names, prefix='ArrisMono-'):
    """[(weight, italic, file name)] for the Mono files among names (<prefix><Style>.<ext>)."""
    out = []
    for n in names:
        base = n.rsplit('/', 1)[-1]
        if not base.startswith(prefix):
            continue
        style = base[len(prefix):].rsplit('.', 1)[0]
        italic = style.endswith('Italic')
        w = MONO.get(style.removesuffix('Italic') or 'Regular')
        if w is not None:
            out.append((w, italic, n))
    return sorted(out)


def mono_rules(styles, narrow=False):
    family = 'Arris Mono Narrow' if narrow else 'Arris Mono'
    return ['@font-face {\n  font-family: "%s";\n  font-weight: %d;\n%s  font-display: swap;\n'
            '  src: url("../fonts/%s") format("woff2");\n}'
            % (family, w, '  font-style: italic;\n' if it else '', mono_file(w, it, narrow))
            for w, it, _ in styles]


def mono_file(w, italic, narrow=False):
    return f'arris-mono-{"narrow-" if narrow else ""}{w}{"-italic" if italic else ""}.woff2'


def mono_only(src: Path):
    """Mono's files and rules from built TTFs; the rest of css/fonts.css is kept."""
    styles = mono_styles([str(p) for p in sorted(src.glob('ArrisMono-*.ttf'))])
    if not styles:
        sys.exit(f'{src}: no ArrisMono-*.ttf')
    for old in FONTS.glob('arris-mono-*.woff2'):
        if not old.name.startswith('arris-mono-narrow-'):
            old.unlink()
    for w, it, path in styles:
        f = TTFont(path)
        f.flavor = 'woff2'
        f.save(FONTS / mono_file(w, it))
    css = (CSS / 'fonts.css').read_text()
    kept = [r for r in css.strip().split('\n@font-face') if '"Arris Mono"' not in r]
    rules = [kept[0]] + ['@font-face' + r for r in kept[1:]] + mono_rules(styles)
    (CSS / 'fonts.css').write_text('\n'.join(rules) + '\n')
    print('mono:', ', '.join(f'{w}{" italic" if it else ""}' for w, it, _ in styles))


def main(zip_path):
    FONTS.mkdir(exist_ok=True); DATA.mkdir(exist_ok=True)
    for old in FONTS.glob('*.woff2'):
        old.unlink()
    z = zipfile.ZipFile(zip_path)
    top = z.namelist()[0].split('/')[0]
    web = lambda name: z.read(f'{top}/web/{name}')
    faces, info = [], None
    for style, src in (('normal', 'Arris[GRAD,WTCH,wght].woff2'), ('italic', 'Arris-Italic[GRAD,WTCH,wght].woff2')):
        data = web(src)
        font = TTFont(io.BytesIO(data))
        cps = set(font.getBestCmap())
        latin = {c for c in cps if any(a <= c <= b for a, b in LATIN)}
        tag = 'arris' if style == 'normal' else 'arris-italic'
        n = save_subset(data, latin, FONTS / f'{tag}-latin.woff2')
        (FONTS / f'{tag}.woff2').write_bytes(data)
        rest = ranges(cps - latin)
        faces.append((style, f'{tag}-latin.woff2', css_range(ranges(latin))))
        faces.append((style, f'{tag}.woff2', css_range(rest)))
        print(f'{tag}: latin {n / 1e3:.0f} kB ({len(latin)} chars), full {len(data) / 1e6:.2f} MB')
        if style == 'normal':
            head, name = font['head'], font['name']
            info = {
                'family': name.getDebugName(1),
                'version': name.getDebugName(5).split(';')[0].replace('Version ', ''),
                'axes': [{'tag': a.axisTag, 'min': a.minValue, 'default': a.defaultValue, 'max': a.maxValue,
                          'name': name.getDebugName(a.axisNameID)} for a in font['fvar'].axes],
                'features': sorted({fr.FeatureTag for fr in font['GSUB'].table.FeatureList.FeatureRecord}),
                'glyphs': font['maxp'].numGlyphs,
                'metrics': {'upm': head.unitsPerEm, 'ascender': font['OS/2'].sTypoAscender,
                            'descender': font['OS/2'].sTypoDescender, 'cap': font['OS/2'].sCapHeight,
                            'x': font['OS/2'].sxHeight},
                'chars': [[c, unicodedata.name(chr(c), ''), block(c)] for c in sorted(cps)],
            }
    webs = [n for n in z.namelist() if n.startswith(f'{top}/web/') and n.endswith('.woff2')]
    styles = mono_styles(webs)
    narrow = mono_styles(webs, 'ArrisMonoNarrow-')
    for w, it, n in styles:
        (FONTS / mono_file(w, it)).write_bytes(z.read(n))
    for w, it, n in narrow:
        (FONTS / mono_file(w, it, True)).write_bytes(z.read(n))
    (DATA / 'font.json').write_text(json.dumps(info, separators=(',', ':'), ensure_ascii=False))
    rules = ['/* written by tools/fonts.py from the release zip; do not edit */']
    for style, file, rng in faces:
        rules.append('@font-face {\n  font-family: "Arris";\n  font-style: %s;\n  font-weight: 100 900;\n'
                     '  font-display: swap;\n  src: url("../fonts/%s") format("woff2");\n  unicode-range: %s;\n}'
                     % (style, file, rng))
    rules += mono_rules(styles) + mono_rules(narrow, True)
    (CSS / 'fonts.css').write_text('\n'.join(rules) + '\n')
    print('mono narrow:', ', '.join(f'{w}{" italic" if it else ""}' for w, it, _ in narrow) or 'none in the zip')
    print(info['family'], info['version'], len(info['chars']), 'chars', info['features'])
    released(info['version'], Path(zip_path).stat().st_size)


def released(version, size):
    """The site's word of the release, from the zip: the version wherever the
    page shows it, the download's link and size, the structured data's
    version, file and date, the sitemap's date and the README's command (so
    none of them is left on the last release)."""
    import datetime
    import re
    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    mb = f'{size / 1e6:.1f} MB'
    zip_url = f'https://github.com/huntrontrakkr/arris-type/releases/download/v{version}/Arris-{version}.zip'
    edits = {
        ROOT / 'index.html': [
            (r'(data-font="version">)[0-9.]+', rf'\g<1>{version}'),
            (r'https://github\.com/huntrontrakkr/arris-type/releases/download/v[0-9.]+/Arris-[0-9.]+\.zip', zip_url),
            (r'<small>ZIP · [0-9.]+ MB</small>', f'<small>ZIP · {mb}</small>'),
            (r'"version": "[0-9.]+"', f'"version": "{version}"'),
            (r'"name": "Arris [0-9.]+ \(', f'"name": "Arris {version} ('),
            (r'"contentSize": "[0-9.]+ MB"', f'"contentSize": "{mb}"'),
            (r'"dateModified": "[0-9-]+"', f'"dateModified": "{today}"'),
        ],
        ROOT / 'sitemap.xml': [(r'<lastmod>[0-9-]+</lastmod>', f'<lastmod>{today}</lastmod>')],
        ROOT / 'README.md': [(r'tools/fonts\.py Arris-[0-9.]+\.zip', f'tools/fonts.py Arris-{version}.zip')],
    }
    for path, subs in edits.items():
        text = path.read_text()
        for pat, rep in subs:
            text = re.sub(pat, rep, text)
        path.write_text(text)
    print(f'site: {version}, {mb}, {today}')


if __name__ == '__main__':
    if sys.argv[1:2] == ['--mono']:
        mono_only(Path(sys.argv[2]))
    else:
        main(sys.argv[1])

# arris-site

The release website for [Arris](https://github.com/huntrontrakkr/arris-type),
a chamfered sans. A static site: no build step, no framework, no backend.

The page has two faces joined at an edge. Above is Paper, the workshop: the
name under your cursor, the watch the figures came from, the axes one at a
time, the character set and the features. Below is Night, the Belt: the
font at work in the world of the films (a dock floor, a survey readout, a
ship's log, a storefront), then how it is built and the download. Between
them is the arris, a 45-degree cut that sweeps across the screen as you
scroll.

Two voices, never mixed: the props are set in the world and never explain
themselves; the captions (marked with a cut-corner square) are plain and say
what the font does. The fiction never stands between a visitor and the
download.

## Running it

Any static server from the repository root:

```
python3 -m http.server 8000
```

## Fonts and media

The fonts come from a release zip, never by hand:

```
pip install fonttools brotli
python3 tools/fonts.py Arris-1.002.zip
```

`tools/fonts.py` copies the variable fonts and Mono, cuts a first-paint
subset (ASCII, Latin-1 and the punctuation an English page sets, about 250
characters, all three axes and every feature) and serves the full fonts for
every other code point through `unicode-range`, so Cyrillic, Greek and the
symbols load only when they appear. It writes `css/fonts.css` and
`data/font.json` (version, axes, features, metrics and every code point
with its Unicode name), which the page reads for everything it states about
the font.

The films are cut to short silent loops with posters by `tools/media.sh`,
from the arris-films repository:

```
tools/media.sh ../arris-films/presentation
```

## Layout

| Path | What |
|---|---|
| `index.html` | the page |
| `css/site.css` | the two faces, the props, the crossing |
| `css/fonts.css` | written by `tools/fonts.py` |
| `js/site.js` | the name, the watch, the axes, the specimen, the features, the crossing |
| `data/font.json` | written by `tools/fonts.py` |
| `media/` | written by `tools/media.sh` |
| `kapa/` | not linked from the navigation |

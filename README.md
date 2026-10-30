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

Any static server from the repository root that answers byte-range
requests, since the board film is scrubbed by the scroll and a browser
cannot seek a video without them. Python's `http.server` does not;
`npx serve` does, and `npx wrangler dev` runs the site as it is published:

```
npx serve .
```

## Fonts and media

The fonts come from a release zip, never by hand:

```
pip install fonttools brotli
python3 tools/fonts.py Arris-1.003.zip
```

`tools/fonts.py` copies the variable fonts and Mono, cuts a first-paint
subset (ASCII, Latin-1 and the punctuation an English page sets, about 250
characters, all three axes and every feature) and serves the full fonts for
every other code point through `unicode-range`, so Cyrillic, Greek and the
symbols load only when they appear. It writes `css/fonts.css` and
`data/font.json` (version, axes, features, metrics and every code point
with its Unicode name), which the page reads for everything it states about
the font.

The upright section's figures and letters, from the watch's pixels through
the Chamfer rule to Arris, are `data/transfer.json`, written by
`tools/transfer.py` from an arris-type checkout (its pixel masters and the
rule) laid on the site's own font at the watch's weight, wght 600 and
WTCH 100. Rerun it after `tools/fonts.py`; it prints how far each glyph sits
from the rule's outline:

```
uv run --project ../arris-type python tools/transfer.py ../arris-type
```

The films are cut to short silent loops with posters by `tools/media.sh`,
from the arris-films repository:

```
tools/media.sh ../arris-films/presentation
```

## Publishing

The site is at https://arristype.com: a Cloudflare Worker that serves the
repository's files (`wrangler.jsonc`), deployed on every push to `main` by
`.github/workflows/deploy.yml`, which then checks the live site from
outside. It needs the repository secret `CLOUDFLARE_API_TOKEN` (the Edit
Cloudflare Workers template, plus DNS edit, for the arristype.com zone),
and `CLOUDFLARE_ACCOUNT_ID` only if the token reaches more than one
account. Everything is published but what
`.assetsignore` lists: this README, `tools/`, `worker/`, `.github/` and the
configuration, which would give the layer underneath away. A wrong address
gets `404.html`. The Worker's own code, `worker/index.js`, runs first only
for `media/`, to answer the byte-range requests the asset server answers
with whole files: Safari plays no film without them, and the board film
seeks as the page scrolls. `www.arristype.com` is a second, tiny Worker
(`worker/www.jsonc`) that sends every address to arristype.com.
`npx wrangler dev` runs the site locally.

## Layout

| Path | What |
|---|---|
| `index.html` | the page |
| `css/site.css` | the two faces, the props, the crossing |
| `css/fonts.css` | written by `tools/fonts.py` |
| `js/site.js` | the name, the upright (the watch, how it's built, the weights), the designspace, the italic, the specimen, the features, the crossing |
| `js/mono.js` | Arris Mono: the code window, the ligature board, the terminal |
| `js/belt.js` | the paperwork and its torn edges, and the two long reads (two pages, one on the other, shuffled by a click on the one behind) whose lines fill in as you reach them |
| `data/font.json` | written by `tools/fonts.py` |
| `data/transfer.json` | written by `tools/transfer.py` |
| `media/` | written by `tools/media.sh` |
| `kapa/` | not linked from the navigation; `sealed.json` is written by `tools/seal.mjs` |
| `404.html` | what a wrong address gets |
| `wrangler.jsonc`, `.assetsignore`, `worker/` | the Worker: what it publishes, the byte ranges it answers for the films, and www |
| `.github/workflows/deploy.yml` | deploys both Workers on every push to `main`, then checks the live site |

## The layer underneath

Some pages are not in the navigation, and some of what they say is sealed:
`tools/seal.mjs` encrypts a transmission with a key derived from its
access code, so the repository holds only ciphertext and the page's source
gives nothing away. Keep the plaintexts and their codes out of the
repository.

```
node tools/seal.mjs CODE < transmission.txt > kapa/sealed.json
```

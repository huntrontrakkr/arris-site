#!/bin/sh
# Web loops and posters from the films (arris-films/presentation): silent
# H.264 at 1280 wide, small enough to autoplay muted, each with a JPEG poster
# from its first frame so the page is complete before any video loads.
#
# usage: tools/media.sh ../arris-films/presentation
set -e
SRC=${1:?path to arris-films/presentation}
OUT=$(dirname "$0")/../media
mkdir -p "$OUT"
loop() {  # name, start s, length s
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$SRC/$1.mp4" -an -vf "scale=1280:-2,format=yuv420p" \
    -c:v libx264 -preset slow -crf 26 -movflags +faststart "$OUT/$1.mp4"
  ffmpeg -v error -y -i "$OUT/$1.mp4" -frames:v 1 -q:v 4 "$OUT/$1.jpg"
  echo "$1: $(du -k "$OUT/$1.mp4" | cut -f1) kB"
}
# a whole short film for the reel beside the weight field (js/reel.js):
# its loop, and a small poster from past its middle, where it has built up
film() {  # name under web/, or a film beside it
  mkdir -p "$OUT/reel"
  n=$(basename "$1")
  ffmpeg -v error -y -i "$SRC/$1.mp4" -an -vf "scale=1280:-2,format=yuv420p" \
    -c:v libx264 -preset slow -crf 28 -movflags +faststart "$OUT/reel/$n.mp4"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/reel/$n.mp4")
  t=$(awk "BEGIN { print $d * 0.55 }")
  ffmpeg -v error -y -ss "$t" -i "$OUT/reel/$n.mp4" -frames:v 1 -vf scale=480:-2 -q:v 5 "$OUT/reel/$n.jpg"
  echo "reel/$n: $(du -k "$OUT/reel/$n.mp4" | cut -f1) kB"
}
for f in web/11-masters web/12-anatomy web/13-squint web/14-grade web/15-kerning web/16-italic web/18-cursive \
  web/19-italic-wave web/17-ligatures web/20-cyrillic web/06-babel web/10-molten gauge-blocks; do film "$f"; done
loop survey 0 8
loop dock 0 6
loop weight-field 0 7.5
# the LED board: a 2.4-second pull-back from DELAYED to the whole board,
# every frame a keyframe, because the page scrubs it with the scroll
ffmpeg -v error -y -ss 2.2 -t 2.4 -i "$SRC/boarding.mp4" -an -vf "scale=960:-2,format=yuv420p" \
  -c:v libx264 -preset slow -crf 27 -g 1 -keyint_min 1 -movflags +faststart "$OUT/board.mp4"
ffmpeg -v error -y -i "$OUT/board.mp4" -frames:v 1 -q:v 4 "$OUT/board.jpg"
echo "board: $(du -k "$OUT/board.mp4" | cut -f1) kB"
# the survey opens on a dark frame: its stills come from the YouTube thumbnail
cp "$SRC/youtube/survey.jpg" "$OUT/survey.jpg"

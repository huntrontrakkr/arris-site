#!/bin/sh
# Web loops and posters from the films (arris-films/presentation): silent
# H.264 at 1280 wide, small enough to autoplay muted, each with a JPEG poster
# from its first frame so the page is complete before any video loads.
#
# usage: tools/media.sh ../arris-films/presentation [the clean DIMENSIONS films' directory]
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
# the reel's films (js/reel.js), from DIMENSIONS shot clean (arris-films/scratch/cube:
# CLEAN=1 main_frames.js and insert_frames.js, then finish.sh), given as a directory holding
# dimensions-clean.mp4, fringes-clean.mp4 and moire-clean.mp4
CLEAN=${2:-}
if [ -n "$CLEAN" ]; then
  R="$OUT/reel"; mkdir -p "$R"
  web() { ffmpeg -v error -y "$@" -an -vf "scale=1280:-2,format=yuv420p" -c:v libx264 -preset slow -crf 26 -movflags +faststart; }
  web -i "$CLEAN/dimensions-clean.mp4" "$R/dimensions.mp4"
  web -ss 2.20 -t 2.80 -i "$CLEAN/dimensions-clean.mp4" "$R/solid.mp4"     # the 8's weight solid, the film's third step
  web -i "$CLEAN/fringes-clean.mp4" "$R/fringes.mp4"
  web -i "$CLEAN/moire-clean.mp4" "$R/moire.mp4"
  for n in dimensions:3.6 solid:1.4 fringes:1.5 moire:1.5; do
    ffmpeg -v error -y -ss "${n##*:}" -i "$R/${n%%:*}.mp4" -frames:v 1 -q:v 4 "$R/${n%%:*}.jpg"
  done
fi
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

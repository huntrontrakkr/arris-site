#!/bin/sh
# Web loops and posters from the films (arris-films/presentation): silent
# H.264 at 1280 wide, small enough to autoplay muted, each with a JPEG poster
# from its first frame so the page is complete before any video loads.
#
# usage: tools/media.sh ../arris-films/presentation [the DIMENSIONS inserts' frames]
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
# the reel beside the weight field (js/reel.js): DIMENSIONS whole, its four
# steps cut from it, and its four inserts as longer loops (their frames by
# arris-films/scratch/cube/insert_frames.js: fringe 75, ct 75, moire 90, rd
# 15, into the directory given second), each with a small poster
DIMS=${2:-}
if [ -n "$DIMS" ]; then
  R="$OUT/reel"; mkdir -p "$R"
  WEB="-an -c:v libx264 -preset slow -crf 26 -movflags +faststart"
  part() {  # name, start s, length s
    ffmpeg -v error -y -ss "$2" -t "$3" -i "$SRC/dimensions.mp4" -vf "scale=1280:-2,format=yuv420p" $WEB "$R/$1.mp4"
  }
  ffmpeg -v error -y -i "$SRC/dimensions.mp4" -vf "scale=1280:-2,format=yuv420p" $WEB "$R/dimensions.mp4"
  part dim-2-flat 0 1.70; part dim-3-weight 2.20 2.80; part dim-4-grade 5.47 2.80; part dim-5-watch 8.80 3.50
  # the films' lens pass (arris-films/scratch/cube/finish.sh)
  LENS="format=gbrp,split[a][b];[b]curves=all='0/0 0.72/0 1/1',gblur=sigma=14[g];[a][g]blend=all_mode=screen:all_opacity=0.45,rgbashift=rh=-1:bh=1,vignette=angle=0.55,noise=alls=4:allf=t+u"
  insert() {  # name, frames' directory, frames a second
    ffmpeg -v error -y -framerate "$3" -i "$DIMS/$2/%04d.png" -vf "$LENS,scale=1280:-2,format=yuv420p" -r 30 $WEB "$R/$1.mp4"
  }
  insert dim-fringes long-fringe 30; insert dim-section long-ct 30; insert dim-growth ins-rd 8; insert dim-moire long-moire 30
  for f in "$R"/*.mp4; do
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
    t=$(awk "BEGIN { print $d * 0.6 }"); [ "$(basename "$f")" = dimensions.mp4 ] && t=3.6
    ffmpeg -v error -y -ss "$t" -i "$f" -frames:v 1 -vf scale=480:-2 -q:v 5 "${f%.mp4}.jpg"
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

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
loop survey 0 8
loop dock 0 6
loop weight-field 0 7.5
# the survey opens on a dark frame: its stills come from the YouTube thumbnail
cp "$SRC/youtube/survey.jpg" "$OUT/survey.jpg"
# the page closes on the deck's last poster, Garden in orbit, without its chrome
python3 -c "from PIL import Image; Image.open('$SRC/slides/41-garden.png').convert('RGB').crop((56, 84, 1852, 1064)).save('$OUT/garden.jpg', quality=86, optimize=True, progressive=True)"

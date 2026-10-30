#!/bin/sh
# Gather what the site publishes into dist/, and nothing else: the build
# Cloudflare Pages runs (build command "sh tools/dist.sh", output "dist").
# The README and tools/ stay in the repository; they would give the layer
# underneath away.
set -e
cd "$(dirname "$0")/.."
rm -rf dist
mkdir dist
cp -R index.html 404.html robots.txt sitemap.xml favicon.svg apple-touch-icon.png css data fonts js kapa media dist/
echo "dist: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"

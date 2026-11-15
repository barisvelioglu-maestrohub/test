#!/usr/bin/env bash
# Builds the playable pages from the sources in this folder:
#   index.html          - open directly in a browser
#   dist/ashen-crowns.html - single-file page fragment for hosts that add their own <html> wrapper
set -euo pipefail
cd "$(dirname "$0")"
FONTS='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;700&family=Almendra+SC&display=swap">'
JS="js/data.js js/sound.js js/mapgen.js js/rules.js js/ai.js js/sprites.js js/ui.js"
inner() {
  echo '<title>Ashen Crowns</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo "$FONTS"
  echo '<style>'; cat style.css; echo '</style>'
  cat body.html
  echo '<script>'; cat $JS; echo '</script>'
}
mkdir -p dist
inner > dist/ashen-crowns.html
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<style>body{margin:0}[hidden]{display:none!important}</style></head><body>'
  inner
  echo '</body></html>'
} > index.html
echo "built index.html and dist/ashen-crowns.html"

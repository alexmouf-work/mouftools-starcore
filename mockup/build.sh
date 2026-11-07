#!/bin/bash
# Assemble the page: the shell and the code, nothing else. Everything heavy is a file beside it, fetched in parallel:
# tex.webp, planets.webp, journey.json, journey.txt (and updates.json / updates.txt when that tab opens). See slim.py.
cd "$(dirname "$0")"
{ cat page.html
  echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
  echo '<script>(() => {'; cat boot.js
  echo 'function start(ASSETS) {'
  echo 'const J_ = ASSETS.J, PLANETS = J_.PLANETS, GPLANET = J_.GPLANET, WORLDS = J_.WORLDS, COAG = J_.COAG, AURORA = J_.AURORA, SISTERS = J_.SISTERS, JETS = J_.jets, HYPER = J_.hyper;'
  cat engine.js upd.js stages.js
  echo '}'; echo '})();</script>'; } > star-core-journey.html
mkdir -p site && cp star-core-journey.html slim/tex.webp slim/planets.webp slim/journey.json slim/journey.txt slim/updates.json slim/updates.txt site/
ls -la site | awk 'NR>1 {s+=$5; print $5, $9} END {print s, "total"}'

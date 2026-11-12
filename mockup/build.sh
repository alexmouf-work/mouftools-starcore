#!/bin/bash
# Assemble the page: the shell and the code, nothing else. Everything heavy is a file beside it: hero.webp first (the opening shot,
# preloaded), then tex.webp, planets.webp, journey.json, journey.txt once that has drawn (and updates.json / .txt when that tab opens).
cd "$(dirname "$0")"
{ cat page.html
  echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
  echo '<script>(() => {'; printf 'const HERO = '; cat slim/hero.json; echo ';'
  cat hero.js boot.js
  echo 'function start(ASSETS) {'
  echo 'const J_ = ASSETS.J, PLANETS = J_.PLANETS, GPLANET = J_.GPLANET, WORLDS = J_.WORLDS, COAG = J_.COAG, AURORA = J_.AURORA, SISTERS = J_.SISTERS, JETS = J_.jets, HYPER = J_.hyper;'
  cat engine.js upd.js stages.js
  echo '}'; echo '})();</script>'; } > star-core-journey.html
mkdir -p site && cp star-core-journey.html slim/hero.webp slim/tex.webp slim/planets.webp slim/journey.json slim/journey.txt slim/updates.json slim/updates.txt cre/out/creatures.json cre/out/creatures.webp site/
ls -la site | awk 'NR>1 {s+=$5; print $5, $9} END {print s, "total"}'

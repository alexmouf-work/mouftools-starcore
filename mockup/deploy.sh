#!/bin/bash
# Write the deployable site into ../public (what vercel.json serves): the built page as a complete HTML document — the artifact
# host supplies <html>/<head>/<body> itself, a plain static host does not — and its data files beside it. Run build.sh first.
set -e
cd "$(dirname "$0")"
mkdir -p ../public
python3 - <<'PY'
s = open("site/star-core-journey.html").read()
i = s.index("</style>") + len("</style>")
doc = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' + s[:i].strip() + '\n<meta name="theme-color" content="#05060f">\n'
       '</head>\n<body>\n' + s[i:].strip() + '\n</body>\n</html>\n')
open("../public/index.html", "w").write(doc)
PY
cp site/hero.webp site/tex.webp site/planets.webp site/journey.json site/journey.txt site/updates.json site/updates.txt site/creatures.json site/creatures.webp site/hyperspace_tunnel.webp site/hyperspace_stars.webp ../public/
cp site/favicon.ico site/icon-512.png site/icon-192.png site/favicon-32.png site/favicon-16.png site/apple-touch-icon.png ../public/
ls -la ../public

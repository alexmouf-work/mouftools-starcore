#!/bin/bash
# Assemble the page: shell, three.js, the Journey's data inline, then the code. The Updates tab's data stays beside it as files.
cd "$(dirname "$0")"
{ cat page.html; echo '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'; echo '<script>'; cat data.js data2.js; echo '</script>'; echo '<script>(() => {'; cat engine.js upd.js stages.js; echo '})();</script>'; } > star-core-journey.html
base64 -w0 upd/updpack.bin > updpack.txt; cp upd/updpack.json upd/upd.png . 2>/dev/null
ls -la star-core-journey.html updpack.txt updpack.json upd.png | awk '{print $5, $9}'

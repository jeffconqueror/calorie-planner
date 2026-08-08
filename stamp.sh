#!/usr/bin/env bash
# Stamp the service-worker cache name with a hash of the app, so that
# deploying a change retires the previous cache instead of stranding it.
set -e
H=$(sha256sum index.html | cut -c1-12)
python3 - "$H" <<'PY'
import re, sys, pathlib
h = sys.argv[1]
p = pathlib.Path("sw.js"); s = p.read_text()
new = re.sub(r"var CACHE = 'load-[^']*';", "var CACHE = 'load-%s';" % h, s, count=1)
assert new != s or ("load-"+h) in s, "cache name not found in sw.js"
p.write_text(new)
print("service worker cache: load-" + h)
PY

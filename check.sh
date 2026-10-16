#!/usr/bin/env bash
# Verification for the single-file app.
set -e
sed -n '/^<script>$/,/^<\/script>$/p' index.html | sed '1d;$d' > /tmp/load-app.js
test -s /tmp/load-app.js
node --check /tmp/load-app.js && echo "app script parses"
node --check sw.js && echo "service worker parses"
python3 -c "import json;json.load(open('manifest.webmanifest'));json.load(open('vercel.json'));print('manifest + vercel.json valid')"
node check-i18n.js
node tests/storage.test.js
node tests/sw.test.js
node tests/meal-cycle.test.js
node tests/training-log.test.js
node tests/workout-journal.test.js
node tests/cloud-merge.test.js
echo "all checks passed"

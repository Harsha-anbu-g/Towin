#!/usr/bin/env bash
# Rebuild the offline API docs (towin-api-docs.html) — the SAME Swagger UI you see
# at http://localhost:8080/swagger-ui.html, but as ONE self-contained file:
# swagger-ui CSS + JS + the OpenAPI spec are all inlined, so it opens in any
# browser with no server, no CDN, no internet.
#
# Requires the backend running on :8080 (it serves the exact swagger-ui assets, so
# the offline copy matches your local version byte-for-byte).
#
# Usage:  ./build-offline-api-docs.sh
set -euo pipefail
cd "$(dirname "$0")"

BASE="http://localhost:8080"
OUT="towin-api-docs.html"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! curl -sf -o /dev/null "$BASE/v3/api-docs"; then
  echo "ERROR: backend not reachable at $BASE. Start it, then re-run." >&2
  exit 1
fi

echo "Downloading swagger-ui assets + spec from $BASE ..."
curl -sf "$BASE/swagger-ui/swagger-ui.css"                  -o "$TMP/swagger-ui.css"
curl -sf "$BASE/swagger-ui/swagger-ui-bundle.js"            -o "$TMP/bundle.js"
curl -sf "$BASE/swagger-ui/swagger-ui-standalone-preset.js" -o "$TMP/preset.js"
curl -sf "$BASE/v3/api-docs"                                -o "$TMP/spec.json"
# Keep the raw spec next to the docs too (handy for Postman / Swagger Editor import).
cp "$TMP/spec.json" towin-openapi.json
curl -sf "$BASE/v3/api-docs.yaml" -o towin-openapi.yaml || true

echo "Inlining into $OUT ..."
{
  printf '%s\n' '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<title>ToWin API — offline</title><style>'
  cat "$TMP/swagger-ui.css"
  printf '\n%s\n' '</style></head><body><div id="swagger-ui"></div><script>'
  cat "$TMP/bundle.js"
  printf '\n%s\n' '</script><script>'
  cat "$TMP/preset.js"
  printf '\n%s\n' '</script><script>window.__TOWIN_SPEC__='
  cat "$TMP/spec.json"
  printf '%s\n' ';window.onload=function(){window.ui=SwaggerUIBundle({spec:window.__TOWIN_SPEC__,dom_id:"#swagger-ui",deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],plugins:[SwaggerUIBundle.plugins.DownloadUrl],layout:"StandaloneLayout"});};</script></body></html>'
} > "$OUT"

echo "Done → $OUT ($(wc -c < "$OUT") bytes). Open it in any browser, offline."

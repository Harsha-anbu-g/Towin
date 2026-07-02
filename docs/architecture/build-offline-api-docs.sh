#!/usr/bin/env bash
# Rebuild the fully self-contained, offline API docs (towin-api-docs.html).
#
# Produces ONE html file with the Redoc engine + the OpenAPI spec inlined — no
# CDN, no server, no internet needed to VIEW it. (`@redocly/cli build-docs`
# alone is NOT offline-safe: it links the Redoc script from cdn.redocly.com.)
#
# Usage:
#   ./build-offline-api-docs.sh            # use the committed towin-openapi.json
#   ./build-offline-api-docs.sh --fresh    # pull a fresh spec from a running :8080 first
set -euo pipefail
cd "$(dirname "$0")"

REDOC_VERSION="v2.5.3"
SPEC="towin-openapi.json"
OUT="towin-api-docs.html"

if [[ "${1:-}" == "--fresh" ]]; then
  echo "Fetching fresh spec from http://localhost:8080/v3/api-docs ..."
  curl -sf http://localhost:8080/v3/api-docs -o "$SPEC"
  curl -sf http://localhost:8080/v3/api-docs.yaml -o towin-openapi.yaml
fi

echo "Downloading Redoc engine ($REDOC_VERSION) ..."   # one-time online step
REDOC_JS="$(mktemp)"
curl -sL "https://cdn.redocly.com/redoc/${REDOC_VERSION}/bundles/redoc.standalone.js" -o "$REDOC_JS"

echo "Inlining engine + spec into $OUT ..."
{
  printf '%s\n' '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width,initial-scale=1">' \
    '<title>ToWin API — offline docs</title>' \
    '<style>body{margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif}</style>' \
    '</head><body><div id="redoc"></div>' \
    '<script>'
  cat "$REDOC_JS"
  printf '\n%s\n' '</script>' '<script>var __TOWIN_SPEC__='
  cat "$SPEC"
  printf '%s\n' ';Redoc.init(__TOWIN_SPEC__,{expandResponses:"200,201",hideDownloadButton:false},document.getElementById("redoc"));</script>' \
    '</body></html>'
} > "$OUT"

rm -f "$REDOC_JS"
echo "Done → $OUT ($(wc -c < "$OUT") bytes). Open it in any browser, offline."

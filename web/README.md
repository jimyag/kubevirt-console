# Web UI assets

The HTML bundle used by the embedded web console lives in `web/`. Every asset is vendored so the Go binary stays self-contained.

## Updating xterm.js (JS + CSS)

```bash
# Run in repo root. Update VERSION to the release you need.
VERSION=5.3.0
curl -fSL "https://cdn.jsdelivr.net/npm/xterm@${VERSION}/lib/xterm.min.js" \
  -o web/assets/xterm.min.js
curl -fSL "https://cdn.jsdelivr.net/npm/xterm@${VERSION}/css/xterm.min.css" \
  -o web/assets/xterm.min.css
```

## Updating xterm fit addon

```bash
# VERSION must satisfy xterm's peer dependency (e.g. 0.8.0 for xterm 5.3.x).
VERSION=0.8.0
curl -fSL "https://cdn.jsdelivr.net/npm/xterm-addon-fit@${VERSION}/lib/xterm-addon-fit.min.js" \
  -o web/assets/xterm-addon-fit.min.js
```

*Remember to rerun `go build` so the embedded files are refreshed.*

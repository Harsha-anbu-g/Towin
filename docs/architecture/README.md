# Architecture / structure views

Two self-updating ways to see how the code is wired — no hand-drawn diagrams to
keep in sync.

## Backend — REST API map (springdoc / Swagger UI)

The API is auto-documented from the controllers. Run the backend and open:

| What | URL |
| --- | --- |
| Interactive API explorer | http://localhost:8080/swagger-ui.html |
| Raw OpenAPI spec (JSON) | http://localhost:8080/v3/api-docs |
| Raw OpenAPI spec (YAML) | http://localhost:8080/v3/api-docs.yaml |

Every endpoint on every `@RestController` shows up automatically with its method,
path, request/response shapes, and auth. Click **Authorize**, paste a JWT, and you
can call secured endpoints straight from the page. Adding a new endpoint updates
this map with zero extra work.

### Offline copy (no server, no internet)

For reading the API without running the backend. These files are **local only —
gitignored** (they expose the full API surface, so they don't belong on GitHub):

- **`towin-api-docs.html`** ← the **exact same Swagger UI as `localhost:8080`**, as a
  single self-contained file (swagger-ui CSS + JS + the OpenAPI spec all inlined).
  **Open it in any browser, fully offline** — no server, no CDN. Same topbar, same
  green Authorize button, all 16 controllers and endpoints. (Try-it-out can't reach a
  live server offline, but every endpoint, schema, and auth detail is browsable.)
- **`towin-openapi.json`** / **`towin-openapi.yaml`** — the raw spec. Import into
  Postman, Insomnia, IntelliJ's HTTP client, or paste at https://editor.swagger.io.

Regenerate (after the API changes) with the backend running on :8080:

```bash
./build-offline-api-docs.sh
```

> It pulls the swagger-ui assets straight from your running backend, so the offline
> copy matches your local Swagger UI byte-for-byte.

## Frontend — module dependency graph (dependency-cruiser)

Shows how `frontend/src` modules import each other (pages → components / context →
`api/axios.js`). Regenerate any time from `frontend/`:

```bash
npm run graph          # visual flow chart  -> docs/architecture/frontend-deps.mmd  (Mermaid)
npm run graph:report   # interactive report -> docs/architecture/frontend-deps.html
```

### Which file to open

- **`frontend-deps-viewer.html`** ← best. A self-contained **zoom + pan viewer** for the
  graph (fits to screen, scroll to zoom, drag to pan, +/−/reset buttons). Open in any
  browser, offline. Best because the raw graph is a very wide ribbon that's hard to read
  without zoom.
- **`frontend-deps.svg`** — the same flow chart as a plain image. Opens in a browser and
  renders on GitHub, but it's ~9600px wide, so you'll be zooming a lot — the viewer above
  is nicer.
- **`frontend-deps.mmd`** — the Mermaid source. In VS Code it only renders with the
  **"Markdown Preview Mermaid Support"** extension; otherwise paste it into
  https://mermaid.live. GitHub renders it too.
- **`frontend-deps.html`** — an interactive dependency matrix *(local only — gitignored)*.

> ⚠️ **`.html` / `.svg` won't render inside the VS Code editor** — double-clicking
> just shows the source text. That's expected: open them in a **browser**, not the editor.

### Regenerating
`npm run graph` / `graph:report` rebuild the `.mmd` / `.html`. The committed `.svg`
was rendered from the `.mmd`. To refresh the SVG with the classic Graphviz look:

```bash
brew install graphviz
npx depcruise src --include-only ^src --output-type dot | dot -T svg -o docs/architecture/frontend-deps.svg
```

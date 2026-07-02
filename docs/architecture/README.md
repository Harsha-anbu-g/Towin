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

For reading the API without running the backend:

- **`towin-api-docs.html`** ← a single self-contained file (Redoc engine + spec both
  inlined). **Open it in any browser, fully offline** — no server, no CDN. 16
  controllers, every endpoint, request/response schemas, auth.
- **`towin-openapi.json`** / **`towin-openapi.yaml`** — the raw spec. Import into
  Postman, Insomnia, IntelliJ's HTTP client, or paste at https://editor.swagger.io.

Regenerate (spec changes) from this folder:

```bash
./build-offline-api-docs.sh          # uses the committed towin-openapi.json
./build-offline-api-docs.sh --fresh  # pull a fresh spec from a running :8080 first
```

> Note: `npx @redocly/cli build-docs` alone is **not** offline-safe — it links the
> Redoc script from a CDN. The script above inlines it so the file works with no
> internet.

## Frontend — module dependency graph (dependency-cruiser)

Shows how `frontend/src` modules import each other (pages → components / context →
`api/axios.js`). Regenerate any time from `frontend/`:

```bash
npm run graph          # visual flow chart  -> docs/architecture/frontend-deps.mmd  (Mermaid)
npm run graph:report   # interactive report -> docs/architecture/frontend-deps.html
```

### Which file to open

- **`frontend-deps.svg`** ← easiest. A rendered flow chart. **Open it in a browser**
  (drag the file into any browser tab, or right-click → Open With → your browser) and
  zoom with ⌘/Ctrl +/−. Also renders on GitHub. No tools, no server.
- **`frontend-deps.mmd`** — the Mermaid source. In VS Code it only renders with the
  **"Markdown Preview Mermaid Support"** extension; otherwise paste it into
  https://mermaid.live. GitHub renders it too.
- **`frontend-deps.html`** — an interactive dependency matrix.

> ⚠️ **`.html` / `.svg` won't render inside the VS Code editor** — double-clicking
> just shows the source text. That's expected: open them in a **browser**, not the editor.

### Regenerating
`npm run graph` / `graph:report` rebuild the `.mmd` / `.html`. The committed `.svg`
was rendered from the `.mmd`. To refresh the SVG with the classic Graphviz look:

```bash
brew install graphviz
npx depcruise src --include-only ^src --output-type dot | dot -T svg -o docs/architecture/frontend-deps.svg
```

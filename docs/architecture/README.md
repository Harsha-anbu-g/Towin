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

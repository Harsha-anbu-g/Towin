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

- **`frontend-deps.mmd`** — a Mermaid flow chart. Preview it in VS Code (Markdown
  Preview Mermaid Support), on GitHub, or at https://mermaid.live. No extra tools.
- **`frontend-deps.html`** — an interactive dependency report you open in a browser.

### Optional: rendered SVG
The Mermaid file needs no tooling. For a classic Graphviz SVG instead:

```bash
brew install graphviz
npx depcruise src --include-only ^src --output-type dot | dot -T svg -o docs/architecture/frontend-deps.svg
```

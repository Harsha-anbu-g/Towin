# Mermaid diagrams — learn by reading your own app

Five diagram types, each drawn from the **real ToWin code** (controllers, entities,
enums, deploy setup). Learn the syntax here, then edit and re-render.

| # | File | Diagram type | What it shows |
|---|---|---|---|
| 1 | [01-flowchart.md](01-flowchart.md) | Flowchart | How a request flows: React pages → axios → JWT filter → controller slices → PostgreSQL |
| 2 | [02-sequence.md](02-sequence.md) | Sequence | Login (`POST /api/auth/login`) and an authorized call, step by step |
| 3 | [03-er-diagram.md](03-er-diagram.md) | Entity Relationship | The database: User, Need, Connection, Message… and how they link |
| 4 | [04-state.md](04-state.md) | State | Lifecycles: Need status, Connection status, and the trust ladder |
| 5 | [05-architecture.md](05-architecture.md) | C4 context | Big picture: Vercel frontend, Railway backend, Postgres, S3, Brevo… |

## How to view

- **GitHub** — just open the file; GitHub renders ```mermaid blocks automatically.
- **VS Code** — install **"Markdown Preview Mermaid Support"**, open a file, press `⌘⇧V`.
- **mermaid.live** — paste the code block (without the ``` fences) to edit interactively.

## Learning order

1 → 2 → 3 → 4 → 5. Flowchart teaches the base syntax (nodes, arrows, subgraphs);
everything else reuses those ideas with a different header keyword.

/** @type {import('dependency-cruiser').IConfiguration} */
// Config for `npm run graph` — maps how frontend/src modules import each other
// (pages -> components/context -> api/axios.js). Visual output via the mermaid
// reporter (no graphviz needed); interactive report via the html reporter.
module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    // Only chart our own source, not third-party packages.
    includeOnly: '^src',
    // Ignore test files so the graph stays about product code.
    exclude: { path: '\\.(test|spec)\\.(js|jsx)$' },
    // Resolve React's .jsx / index files the way Vite does.
    enhancedResolveOptions: {
      extensions: ['.js', '.jsx', '.mjs', '.cjs', '.json'],
      mainFields: ['module', 'main'],
    },
    reporterOptions: {
      // Group files by top-level folder so the high-level view is readable.
      archi: { collapsePattern: '^src/[^/]+' },
      dot: { collapsePattern: '^src/(components|pages|api|context|lib|data|assets)/[^/]+' },
    },
  },
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular imports make the module graph hard to reason about.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: 'Module imported by nothing and importing nothing — likely dead code.',
      severity: 'info',
      from: { orphan: true, pathNot: '\\.(css|json)$|main\\.jsx$' },
      to: {},
    },
  ],
};

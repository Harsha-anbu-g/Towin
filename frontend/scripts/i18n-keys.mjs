// Every English sentence the website can pass to tr(), read from the source.
// Same rules as the iPhone app's scripts/i18n-keys.js.
//
// Used by src/i18n/coverage.test.js (every sentence has a French and a Tamil
// line, with the same placeholders) and by anyone adding a language:
//   node scripts/i18n-keys.mjs > keys.json
//
// Three ways a sentence reaches tr():
//   tr('Literal text')                         the sentence itself
//   tr(SOME_CONSTANT)                          a module-level string constant
//   tr(item) over a list                       every string in a module-level list
// The last two are found by collecting module-level strings and lists, so a
// list rendered through tr() is covered without naming it here.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_FILES = new Set([
  'src/lib/legalCopy.js', // legal text: a professional translation, not this dictionary
  'src/pages/Admin.jsx', // staff only
  'src/pages/Privacy.jsx',
  'src/pages/Terms.jsx',
]);

export function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = join(dir, name);
      if (statSync(join(ROOT, rel)).isDirectory()) {
        if (!['i18n', 'test', 'node_modules', '__tests__'].includes(name)) walk(rel);
      } else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name) && !SKIP_FILES.has(rel)) {
        out.push(rel);
      }
    }
  };
  walk('src');
  return out.sort();
}

// The text of a literal, a template with no ${}, or a + chain of those.
function literalText(n) {
  if (!n) return null;
  if (n.type === 'StringLiteral') return n.value;
  if (n.type === 'TemplateLiteral' && n.expressions.length === 0) return n.quasis[0].value.cooked;
  if (n.type === 'BinaryExpression' && n.operator === '+') {
    const a = literalText(n.left);
    const b = literalText(n.right);
    return a === null || b === null ? null : a + b;
  }
  return null;
}

function walkNodes(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => walkNodes(c, visit));
    else if (v && typeof v.type === 'string') walkNodes(v, visit);
  }
}

export function extractKeys() {
  const direct = new Set();
  const constants = new Map(); // NAME -> text, module-level string constants anywhere
  const listed = new Set(); // strings from module-level lists
  const indirectNames = new Set(); // identifiers passed to tr()

  for (const rel of sourceFiles()) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
    for (const stmt of ast.program.body) {
      const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
      if (!decl || decl.type !== 'VariableDeclaration') continue;
      for (const d of decl.declarations) {
        if (d.id.type !== 'Identifier' || !d.init) continue;
        const text = literalText(d.init);
        if (text !== null) constants.set(d.id.name, text);
        walkNodes(d.init, (n) => {
          if (n.type !== 'ArrayExpression') return;
          // A list carrying CSS selectors ('.tm-leg-tr') is layout, not copy.
          if (n.elements.some((el) => /^[.#]\w/.test(literalText(el) || ''))) return;
          for (const el of n.elements) {
            const t = literalText(el);
            // Copy, not data: enum values, query keys, ids and secrets are left
            // out. Copy has a space or starts with a capital.
            const copy = t !== null && /[a-z]/.test(t) && (/\s/.test(t) || /^[A-Z][a-z]/.test(t))
              && !/[!@#$%^&*=_/\\]|\d{3}/.test(t);
            if (copy) listed.add(t);
          }
        });
      }
    }
    walkNodes(ast.program, (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || n.callee.name !== 'tr') return;
      const arg = n.arguments[0];
      const text = literalText(arg);
      if (text !== null) direct.add(text);
      else if (arg && arg.type === 'Identifier') indirectNames.add(arg.name);
    });
  }

  const keys = new Set(direct);
  for (const name of indirectNames) if (constants.has(name)) keys.add(constants.get(name));
  for (const t of listed) keys.add(t);
  return [...keys].filter((k) => /[A-Za-z]/.test(k)).sort();
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(extractKeys(), null, 2));
}

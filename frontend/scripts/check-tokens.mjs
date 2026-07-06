#!/usr/bin/env node
// Theme-token gate: fails CI when a raw hex color appears in JSX outside the
// audited allowlist. Night mode is token-driven ([data-theme="dark"] remaps
// var(--…) in src/index.css); a raw hex renders identically in both themes and
// silently breaks dark mode. Keep ALLOWED_HEX in sync with eslint.config.js.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED_HEX = new Set([
  'fff', 'ffffff',
  '9b3535', '7a2a2a',
  'ffc107', 'ff3d00', '4caf50', '1976d2',
  '4285f4', '34a853', 'fbbc05', 'ea4335',
  'f4c95e', 'f5b400', 'f59e0b', 'b45309',
  'ff9500', 'ff3b30', '5fa670',
  '1d1d1f', 'f5f5f7', '4fa3ce', '201f1d',
  '1f2933', 'f0f4f8', '7cc4e8',
  '020817', '0a0a0f', '003d7a',
  '5fb2d8', '3e8ab0', '7fc0e0', '2a7da8',
  '9c7a3c',
  '0a9396', '8b939d', '9aa4af', 'c0c0c5', '3b82f6',
]);

const HEX_RE = /#([0-9a-f]{3,8})\b/gi;
const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!p.endsWith('.jsx') || p.endsWith('.test.jsx')) continue;
    const lines = readFileSync(p, 'utf8').split('\n');
    // Prose in comments may name a hex (e.g. explaining a blend mode); track
    // /* … */ state across lines and strip // tails so only code is scanned.
    let inBlock = false;
    lines.forEach((rawLine, i) => {
      let line = '';
      let rest = rawLine;
      while (rest.length) {
        if (inBlock) {
          const close = rest.indexOf('*/');
          if (close === -1) { rest = ''; break; }
          rest = rest.slice(close + 2);
          inBlock = false;
        } else {
          const open = rest.indexOf('/*');
          const slash = rest.indexOf('//');
          if (slash !== -1 && (open === -1 || slash < open)) { line += rest.slice(0, slash); rest = ''; break; }
          if (open === -1) { line += rest; rest = ''; break; }
          line += rest.slice(0, open);
          rest = rest.slice(open + 2);
          inBlock = true;
        }
      }
      for (const m of line.matchAll(HEX_RE)) {
        if (!ALLOWED_HEX.has(m[1].toLowerCase())) {
          violations.push(`${p}:${i + 1}  ${m[0]}  ${line.trim().slice(0, 80)}`);
        }
      }
    });
  }
}

walk(new URL('../src', import.meta.url).pathname);

if (violations.length) {
  console.error('Raw hex colors found — these break night mode. Use var(--token) from src/index.css:\n');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} violation(s). If a color is genuinely theme-independent, add it to ALLOWED_HEX here AND in eslint.config.js.`);
  process.exit(1);
}
console.log('check-tokens: no raw hex colors outside the audited allowlist.');

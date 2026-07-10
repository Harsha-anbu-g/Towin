import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// Night mode (2026-07-05) is driven entirely by CSS tokens: a raw hex color in
// JSX renders the same in both themes and silently breaks dark mode. Every
// theme-dependent color must be a var(--token) from src/index.css. The hexes
// below are the audited exceptions that are the same in BOTH themes on purpose.
// scripts/check-tokens.mjs enforces the same list as a hard CI gate.
const ALLOWED_HEX = [
  'fff', 'ffffff',                                  // white on filled controls / photo frames
  '9b3535', '7a2a2a',                               // SOS — never themed
  'ffc107', 'ff3d00', '4caf50', '1976d2',           // Google logo (Login/Register)
  '4285f4', '34a853', 'fbbc05', 'ea4335',           // Google logo (ProfileEdit)
  'f4c95e', 'f5b400', 'f59e0b', 'b45309',           // star/amber accents
  'ff9500', 'ff3b30', '5fa670',                     // password-strength signals
  '1d1d1f', 'f5f5f7', '4fa3ce', '201f1d',           // dark toast pill + theme-color meta
  '1f2933', 'f0f4f8', '7cc4e8',                     // cookie notice (dark in both themes)
  '020817', '0a0a0f', '003d7a',                     // aurora / dark hero decorations
  '5fb2d8', '3e8ab0', '7fc0e0', '2a7da8',           // brand-blue gradients
  '9c7a3c',                                         // trust-gold active pill fill
  '0a9396', '8b939d', '9aa4af', 'c0c0c5', '3b82f6', // audited one-off accents
]
const HEX_GUARD = `#(?!(?:${ALLOWED_HEX.join('|')})\\b)[0-9a-f]{3,8}\\b`

export default defineConfig([
  // dist + .vercel are build outputs; linting them buries real errors in noise.
  globalIgnores(['dist', '.vercel']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Core ESLint can't see JSX *element* usage (that needs eslint-plugin-react's
      // jsx-uses-vars), so Capitalized bindings rendered only as <Foo /> would be
      // flagged. Ignore the ^[A-Z_] convention in all three binding positions —
      // variables, params ({ icon: Icon }), and array destructuring ([I, label]).
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^[A-Z_]',
        destructuredArrayIgnorePattern: '^[A-Z_]',
      }],
    },
  },
  {
    // Theme-token guard — see ALLOWED_HEX above.
    files: ['src/**/*.jsx'],
    ignores: ['**/*.test.jsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX_GUARD}/i]`,
          message: 'Raw hex color breaks night mode — use a var(--token) from src/index.css (or add an audited exception to ALLOWED_HEX + scripts/check-tokens.mjs).',
        },
        {
          selector: `TemplateElement[value.raw=/${HEX_GUARD}/i]`,
          message: 'Raw hex color in template string breaks night mode — use a var(--token) from src/index.css.',
        },
      ],
    },
  },
  {
    // Build/tool config files run under Node, not the browser.
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])

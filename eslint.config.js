import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'data', 'prisma/dev.db', '**/*.d.ts', 'coverage'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // This codebase intentionally uses `any` at dynamic boundaries (API
      // envelopes, Prisma JSON strings); keep it as a warning, not an error.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Intentional: sanitizer strips control characters from OCR/PDF text.
      'no-control-regex': 'off',
      // Opinionated stylistic rules (new in ESLint v10) — not correctness issues.
      'preserve-caught-error': 'off',
      'no-useless-assignment': 'off',
    },
  },
  // Node/back-end files may use console for structured logger internals.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', fetch: 'readonly' } },
  },
  prettier,
);

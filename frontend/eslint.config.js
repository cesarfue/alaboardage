import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      globals: { ...globals.browser },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-undef': 'off', // TypeScript handles this
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: { parser: tsparser },
      globals: { ...globals.browser },
    },
    rules: {
      // $props() destructuring is used in the template — TS/svelte-check handles unused vars
      'no-unused-vars': 'off',
      // URLSearchParams used inside functions doesn't need to be reactive
      'svelte/prefer-svelte-reactivity': 'off',
      // resolve() preloading is optional, not a correctness issue
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    ignores: [
      '.svelte-kit/',
      'build/',
      'node_modules/',
      'src/lib/components/ui/', // shadcn generated — don't lint
    ],
  },
];

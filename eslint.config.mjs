import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/coverage/**',
    '**/dist/**',
    '**/build/**',
    '**/node_modules/**',
    '**/*.tsbuildinfo',
    '**/*.d.ts',
    '.gitnexus/**',
    '.agents/**',
    '.claude/**',
    '.cursor/**',
    '.codex/**',
    '.commandcode/**',
    '.playwright-mcp/**',
    '.serena/**',
  ]),
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        jsxPragma: null,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    rules: {
      'no-console': 'error',
      'no-alert': 'error',
    },
  },
  {
    files: ['verify-script/**', 'src/utils/**', 'test_data/**', 'tests/**'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: ['src/**/*.{js,jsx,ts,tsx}'],
  },
  {
    files: ['*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
]);

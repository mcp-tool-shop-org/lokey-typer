import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@lib-internal', '@lib-internal/*'],
              message: 'Features/UI must not import lib internals. Use the @lib public API.',
            },
            {
              group: ['@lib/*'],
              message: 'Import from @lib (public API) only; do not deep-import modules.',
            },
            {
              group: [
                '../lib',
                '../lib/*',
                '../../lib',
                '../../lib/*',
                '../../../lib',
                '../../../lib/*',
                './lib',
                './lib/*',
                'src/lib',
                'src/lib/*',
              ],
              message: 'Do not import src/lib via relative/absolute paths from features. Use @lib only.',
            },
          ],
        },
      ],
    },
  },
])

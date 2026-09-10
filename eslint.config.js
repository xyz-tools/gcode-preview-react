import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  reactHooks.configs.flat['recommended-latest'],
  prettierRecommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      camelcase: 'error',
      'spaced-comment': ['error', 'always', { markers: ['/'] }],
      quotes: ['error', 'single'],
      'no-duplicate-imports': 'error'
    }
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: globals.vitest
    }
  }
);

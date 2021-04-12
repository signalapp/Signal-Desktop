// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// For reference: https://github.com/airbnb/javascript

const rules = {
  'comma-dangle': [
    'error',
    {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never',
    },
  ],

  // Overrides recommended by typescript-eslint
  //   https://github.com/typescript-eslint/typescript-eslint/releases/tag/v4.0.0
  '@typescript-eslint/no-redeclare': 'error',
  '@typescript-eslint/no-shadow': 'error',
  '@typescript-eslint/no-useless-constructor': ['error'],
  'no-shadow': 'off',
  'no-useless-constructor': 'off',

  // prevents us from accidentally checking in exclusive tests (`.only`):
  'mocha/no-exclusive-tests': 'error',

  // encourage consistent use of `async` / `await` instead of `then`
  'more/no-then': 'error',

  // it helps readability to put public API at top,
  'no-use-before-define': 'off',

  // useful for unused or internal fields
  'no-underscore-dangle': 'off',

  // useful for unused parameters
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

  // though we have a logger, we still remap console to log to disk
  'no-console': 'error',

  // consistently place operators at end of line except ternaries
  'operator-linebreak': [
    'error',
    'after',
    { overrides: { '?': 'ignore', ':': 'ignore' } },
  ],

  quotes: [
    'error',
    'single',
    { avoidEscape: true, allowTemplateLiterals: false },
  ],

  'no-continue': 'off',

  // Prettier overrides:
  'arrow-parens': 'off',
  'function-paren-newline': 'off',
  'max-len': [
    'error',
    {
      // Prettier generally limits line length to 80 but sometimes goes over.
      // The `max-len` plugin doesn’t let us omit `code` so we set it to a
      // high value as a buffer to let Prettier control the line length:
      code: 999,
      // We still want to limit comments as before:
      comments: 90,
      ignoreUrls: true,
    },
  ],

  'react/jsx-props-no-spreading': 'off',

  // Updated to reflect future airbnb standard
  // Allows for declaring defaultProps inside a class
  'react/static-property-placement': ['error', 'static public field'],

  // JIRA: DESKTOP-657
  'react/sort-comp': 'off',

  // We don't have control over the media we're sharing, so can't require
  // captions.
  'jsx-a11y/media-has-caption': 'off',

  // We prefer named exports
  'import/prefer-default-export': 'off',

  // Prefer functional components with default params
  'react/require-default-props': 'off',

  'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],

  // Upgrade from a warning
  '@typescript-eslint/explicit-module-boundary-types': 'error',

  'no-restricted-syntax': [
    'error',
    {
      selector: 'TSInterfaceDeclaration',
      message:
        'Prefer `type`. Interfaces are mutable and less powerful, so we prefer `type` for simplicity.',
    },
    // Defaults
    {
      selector: 'ForInStatement',
      message:
        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    },
    {
      selector: 'ForOfStatement',
      message:
        'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
    },
    {
      selector: 'LabeledStatement',
      message:
        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    },
    {
      selector: 'WithStatement',
      message:
        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    },
  ],
  curly: 'error',
};

module.exports = {
  root: true,
  settings: {
    react: {
      version: 'detect',
    },
    'import/core-modules': ['electron'],
  },

  extends: ['airbnb-base', 'prettier'],

  plugins: ['mocha', 'more'],

  overrides: [
    {
      files: ['ts/**/*.ts', 'ts/**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: 'tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'airbnb-typescript-prettier',
      ],
      rules,
    },
    {
      files: ['sticker-creator/**/*.ts', 'sticker-creator/**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './sticker-creator/tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'airbnb-typescript-prettier',
      ],
      rules,
    },
    {
      files: ['**/*.stories.tsx', 'ts/build/**', 'ts/test-*/**'],
      rules: {
        ...rules,
        'import/no-extraneous-dependencies': 'off',
        'react/no-array-index-key': 'off',
      },
    },
  ],

  rules,
};

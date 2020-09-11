// For reference: https://github.com/airbnb/javascript

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
      files: ['*.ts', '*.tsx'],
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
    },
    {
      files: ['**/*.stories.tsx'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
        'react/jsx-props-no-spreading': 'off',
      },
    },
  ],

  rules: {
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

    // prevents us from accidentally checking in exclusive tests (`.only`):
    'mocha/no-exclusive-tests': 'error',

    // encourage consistent use of `async` / `await` instead of `then`
    'more/no-then': 'error',

    // it helps readability to put public API at top,
    'no-use-before-define': 'off',

    // useful for unused or internal fields
    'no-underscore-dangle': 'off',

    // though we have a logger, we still remap console to log to disk
    'no-console': 'error',

    // consistently place operators at end of line except ternaries
    'operator-linebreak': [
      'error',
      'after',
      { overrides: { '?': 'ignore', ':': 'ignore' } },
    ],

    // Temporarily turned off during transition from TSLint
    // JIRA: DESKTOP-623
    'import/order': 'off',
    'no-else-return': 'off',
    'no-async-promise-executor': 'off',
    'prefer-object-spread': 'off',
    strict: 'off',

    quotes: [
      'error',
      'single',
      { avoidEscape: true, allowTemplateLiterals: false },
    ],

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
  },
};

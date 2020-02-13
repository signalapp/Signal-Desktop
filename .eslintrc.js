// For reference: https://github.com/airbnb/javascript

module.exports = {
  settings: {
    'import/core-modules': ['electron'],
  },

  extends: ['airbnb-base', 'prettier'],

  plugins: ['mocha', 'more'],

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

    // Enforce curlies always
    curly: ['error', 'all'],
    'brace-style': ['error', '1tbs'],

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
    'operator-linebreak': 'error',

    // Use LF to stay consistent
    'linebreak-style': ['error', 'unix'],

    quotes: [
      'error',
      'single',
      { avoidEscape: true, allowTemplateLiterals: true },
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
        comments: 150,
        ignoreUrls: true,
        ignoreRegExpLiterals: true,
      },
    ],
  },
};

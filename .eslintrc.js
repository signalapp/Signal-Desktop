// For reference: https://github.com/airbnb/javascript

module.exports = {
  settings: {
    'import/core-modules': [
      'electron'
    ]
  },

  extends: [
    'airbnb-base',
  ],

  rules: {
    'comma-dangle': ['error', {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
    }],

    // putting params on their own line helps stay within line length limit
    'function-paren-newline': ['error', 'multiline'],

    // 90 characters allows three+ side-by-side screens on a standard-size monitor
    'max-len': ['error', {
      code: 90,
      ignoreUrls: true,
    }],

    // it helps readability to put public API at top,
    'no-use-before-define': 'off',

    // useful for unused or internal fields
    'no-underscore-dangle': 'off',

    // though we have a logger, we still remap console to log to disk
    'no-console': 'off',

    'operator-linebreak': ["error", "after", { "overrides": { '?': 'before', ':': 'before' } }]
  }
};

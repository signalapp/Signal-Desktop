// For reference: https://github.com/airbnb/javascript

module.exports = {
  env: {
    mocha: true,
    browser: true,
  },

  "globals": {
    check: true,
    gen: true,
  },

  parserOptions: {
    sourceType: 'module',
  },

  rules: {
    // We still get the value of this rule, it just allows for dev deps
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: true
    }],

    // We want to keep each test structured the same, even if its contents are tiny
    'arrow-body-style': 'off',
  }
};

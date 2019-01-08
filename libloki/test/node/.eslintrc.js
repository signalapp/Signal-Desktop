// For reference: https://github.com/airbnb/javascript

module.exports = {
  env: {
    mocha: true,
    browser: false,
  },

  parserOptions: {
    sourceType: 'module',
  },

  rules: {
    // We still get the value of this rule, it just allows for dev deps
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: true,
      },
    ],
  },
};

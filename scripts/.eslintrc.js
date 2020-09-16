module.exports = {
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

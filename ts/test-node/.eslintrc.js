// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { update } = require('lodash/fp');
const topLevelEslintrc = require('../../.eslintrc');

const typescriptRules = topLevelEslintrc.overrides.find(override =>
  override.files.some(glob => glob.endsWith('.ts'))
).rules;
const noRestrictedImportsRule =
  typescriptRules['@typescript-eslint/no-restricted-imports'];

module.exports = {
  rules: {
    '@typescript-eslint/no-restricted-imports': update(
      [1, 'paths'],
      (paths = []) => paths.filter(path => path.name !== 'electron'),
      noRestrictedImportsRule
    ),
  },
};

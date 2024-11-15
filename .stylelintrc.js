// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

module.exports = {
  extends: [
    'stylelint-config-recommended-scss',
    'stylelint-config-css-modules',
  ],
  plugins: ['stylelint-use-logical-spec'],
  rules: {
    // Disabled from recommended set to get stylelint working initially
    'block-no-empty': null,
    'declaration-block-no-duplicate-properties': null,
    'declaration-block-no-shorthand-property-overrides': null,
    'font-family-no-missing-generic-family-keyword': null,
    'no-duplicate-selectors': null,
    'no-descending-specificity': null,
    'selector-pseudo-element-no-unknown': null,
    'scss/at-import-partial-extension': null,
    'scss/comment-no-empty': null,
    'scss/no-global-function-names': null,
    'scss/operator-no-newline-after': null,
    'scss/operator-no-unspaced': null,
    'scss/function-no-unknown': null,
    'scss/load-partial-extension': null,
    'unit-no-unknown': null,
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['placeholder'],
      },
    ],
    // RTL
    'liberty/use-logical-spec': [
      'always',
      {
        except: [/\btop\b/, /\bbottom\b/, /\bwidth\b/, /\bheight\b/],
      },
    ],
    'declaration-property-value-disallowed-list': {
      // Use dir="ltr/rtl" instead
      direction: ['ltr', 'rtl', 'auto'],
      transform: [/translate3d\(/, /translateX\(/, /translate\(/],
      translate: [/./],
    },
  },
};

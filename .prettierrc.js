// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/** @type {import("prettier").Config} */
module.exports = {
  singleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'es5',
  overrides: [
    {
      files: ['./ts/axo/**.tsx'],
      plugins: ['prettier-plugin-tailwindcss'],
      options: {
        tailwindStylesheet: './ts/axo/tailwind.css',
        tailwindFunctions: ['css'],
      },
    },
  ],
};

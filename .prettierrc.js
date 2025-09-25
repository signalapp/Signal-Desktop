// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/** @type {import("prettier").Config} */
module.exports = {
  plugins: ['prettier-plugin-tailwindcss'],
  singleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'es5',
  tailwindStylesheet: './stylesheets/tailwind-config.css',
  tailwindFunctions: ['tw'],
  tailwindAttributes: [],
};

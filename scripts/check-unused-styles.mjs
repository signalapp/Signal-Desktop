// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { styleText } from 'node:util';
import { PurgeCSS } from 'purgecss';
import createParser from 'postcss-selector-parser';

/** @import { Node } from 'postcss-selector-parser' */

/** @type {import("purgecss").Options} */
const options = {
  content: ['{app,ts}/**/*.{ts,tsx}', '*.html'],
  css: ['stylesheets/manifest.css'],
  rejected: true,
  dynamicAttributes: ['data-focus-visible', 'data-dragging'],
  safelist: {
    standard: ['ql-container', ':has', ':empty', ':focus-visible', ':disabled'],
  },
};

const results = await new PurgeCSS().purge(options);

const rejected = results.flatMap(result => {
  return result.rejected ?? [];
});

const QUIET_CLASSES = new Set(['dark-theme']);

/**
 * @param {string} input
 * @param {string} match
 * @returns {string | null}
 */
function safeIndexOf(input, match) {
  const index = input.indexOf(match);
  return index === -1 ? null : index;
}

/**
 * @param {string} input
 * @returns {[string, string]}
 */
function getPrefixAndRest(input) {
  const split = safeIndexOf(input, '__') ?? safeIndexOf(input, '--');
  if (split == null) {
    return [input, ''];
  }
  return [input.slice(0, split), input.slice(split)];
}

const parseSelector = createParser(root => {
  /**
   * @param {Node} node
   * @returns {string}
   */
  function walk(node) {
    let res = '';
    res += node.spaces.before;
    if (node.type === 'root') {
      res += node.map(selector => walk(selector)).join(',');
    } else if (node.type === 'selector') {
      res += node.map(part => walk(part)).join('');
    } else if (node.type === 'class') {
      if (QUIET_CLASSES.has(node.value)) {
        res += styleText('gray', `.${node.value}`);
      } else {
        const [prefix, rest] = getPrefixAndRest(node.value);
        res += styleText('magenta', `.${prefix}`);
        res += styleText('cyan', rest);
      }
    } else if (node.type === 'pseudo') {
      res += styleText('gray', node.value);
      if (node.length > 0) {
        res += styleText('gray', '(');
        res += node.map(item => walk(item)).join(',');
        res += styleText('gray', ')');
      }
    } else if (node.type === 'combinator') {
      res += styleText('gray', node.value);
    } else if (node.type === 'tag') {
      res += node.value;
    } else if (node.type === 'attribute') {
      res += node.toString();
    } else if (node.type === 'id') {
      res += node.value;
    } else {
      throw new TypeError(`unsupported node type: ${node.type}`);
    }
    res += node.spaces.after;
    return res;
  }

  console.log(walk(root));
});

for (const selector of rejected) {
  parseSelector.processSync(selector.trim());
}

const count = rejected.length;

if (rejected.length > 0) {
  console.error();
  console.error(
    styleText('red', `Found ${count} unused CSS selectors, please remove them`)
  );
  process.exit(1);
}

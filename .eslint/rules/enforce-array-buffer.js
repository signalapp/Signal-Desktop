// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    hasSuggestions: true,
    fixable: true,
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (node.typeName.type !== 'Identifier') {
          return;
        }

        let replacement;
        if (node.typeName.name === 'Uint8Array') {
          replacement = 'Uint8Array<ArrayBuffer>';
        } else if (node.typeName.name === 'Buffer') {
          replacement = 'Buffer<ArrayBuffer>';
        } else {
          return;
        }

        if (node.typeParameters != null) {
          return;
        }

        context.report({
          node,
          message: `Should be ${replacement}`,
          fix(fixer) {
            return [fixer.replaceTextRange(node.range, replacement)];
          },
        });
      },
    };
  },
};

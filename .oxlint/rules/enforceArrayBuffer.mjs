// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';

export const enforceArrayBuffer = ESLintUtils.RuleCreator.withoutDocs({
  name: 'enforce-array-buffer',
  meta: {
    type: 'problem',
    fixable: 'code',
    messages: {
      shouldUseArrayBuffer: `Should be {{replacement}}`,
    },
    schema: [],
    defaultOptions: [],
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

        if (node.typeArguments != null) {
          return;
        }

        context.report({
          node,
          messageId: 'shouldUseArrayBuffer',
          data: { replacement },
          fix(fixer) {
            return [fixer.replaceTextRange(node.range, replacement)];
          },
        });
      },
    };
  },
});

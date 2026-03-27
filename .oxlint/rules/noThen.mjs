// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { isPropertyAccess } from './utils/astUtils.mjs';

export const noThen = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-then',
  meta: {
    type: 'problem',
    messages: {
      preferAwait: 'Prefer await instead of .then()',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!isPropertyAccess(node, 'then')) {
          return;
        }

        if (node.parent.type !== 'CallExpression') {
          return;
        }

        context.report({
          node: node.property,
          messageId: 'preferAwait',
        });
      },
    };
  },
});

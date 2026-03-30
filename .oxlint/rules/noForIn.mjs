// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';

export const noForIn = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-for-in',
  meta: {
    type: 'problem',
    messages: {
      preferForOf: 'Prefer for..of loops',
    },
    schema: [],
  },
  create(context) {
    return {
      ForInStatement(node) {
        context.report({
          node,
          messageId: 'preferForOf',
        });
      },
    };
  },
});

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { getReferenceType } from './utils/getReferenceType.mjs';
import { isPropertyAccess } from './utils/astUtils.mjs';

export const noDisabledTests = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-disabled-tests',
  meta: {
    type: 'problem',
    hasSuggestions: true,
    messages: {
      unexpectedDisabledTest: 'Unexpected disabled test',
      removeSkip: 'Remove .skip()',
    },
    schema: [],
    defaultOptions: [],
  },
  create(context) {
    const { sourceCode } = context;

    return {
      MemberExpression(node) {
        if (node.object.type !== 'Identifier') {
          return;
        }

        let replacement;
        if (node.object.name === 'describe') {
          replacement = 'describe';
        } else if (node.object.name === 'it') {
          replacement = 'it';
        } else if (node.object.name === 'test') {
          replacement = 'test';
        } else {
          return;
        }

        if (!isPropertyAccess(node, 'skip')) {
          return;
        }

        const refType = getReferenceType(sourceCode, node.object);
        if (refType != null && refType !== 'global') {
          return;
        }

        context.report({
          node,
          messageId: 'unexpectedDisabledTest',
          suggest: [
            {
              messageId: 'removeSkip',
              fix(fixer) {
                return [fixer.replaceTextRange(node.range, replacement)];
              },
            },
          ],
        });
      },
    };
  },
});

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { getReferenceType } from './utils/getReferenceType.mjs';
import { isPropertyAccess } from './utils/astUtils.mjs';

export const noFocusedTests = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-focused-tests',
  meta: {
    type: 'problem',
    hasSuggestions: true,
    fixable: 'code',
    messages: {
      unexpectedFocusedTest: 'Unexpected focused test',
    },
    schema: [],
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

        if (!isPropertyAccess(node, 'only')) {
          return;
        }

        const refType = getReferenceType(sourceCode, node.object);
        if (refType != null && refType !== 'global') {
          return;
        }

        context.report({
          node,
          messageId: 'unexpectedFocusedTest',
          fix(fixer) {
            if (node.range == null) {
              return null;
            }
            return [fixer.replaceTextRange(node.range, replacement)];
          },
        });
      },
    };
  },
});

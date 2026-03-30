// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { getReferenceType } from './getReferenceType.mjs';
import { isStringLiteral } from './astUtils.mjs';

/**
 * @typedef {import("@typescript-eslint/utils").TSESTree.StringLiteral} StringLiteral
 * @typedef {import("@typescript-eslint/utils").TSESLint.SourceCode} SourceCode
 * @typedef {import("@typescript-eslint/utils").TSESLint.RuleListener} RuleListener
 */

/**
 * @param {SourceCode} sourceCode
 * @param {(source: StringLiteral) => void} visitSource
 * @returns {RuleListener}
 */
export function createImportSourceVisitor(sourceCode, visitSource) {
  return {
    // import ... from '<source>'
    ImportDeclaration(node) {
      visitSource(node.source);
    },
    // import('<source>')
    ImportExpression(node) {
      if (!isStringLiteral(node.source)) {
        return;
      }
      visitSource(node.source);
    },
    CallExpression(node) {
      // require('<source>')
      if (node.callee.type === 'Identifier') {
        if (node.callee.name !== 'require') {
          return;
        }
        const refType = getReferenceType(sourceCode, node.callee);
        if (refType != null && refType !== 'global') {
          return;
        }

        const arg = node.arguments.at(0);
        if (!isStringLiteral(arg)) {
          return;
        }

        visitSource(arg);
        return;
      }

      // require.resolve('<source>')
      if (node.callee.type === 'MemberExpression') {
        const { object, property } = node.callee;

        if (object.type !== 'Identifier') {
          return;
        }
        if (object.name !== 'require') {
          return;
        }
        const refType = getReferenceType(sourceCode, object);
        if (refType != null && refType !== 'global') {
          return;
        }

        if (property.type !== 'Identifier') {
          return;
        }
        if (property.name !== 'resolve') {
          return;
        }

        const arg = node.arguments.at(0);
        if (!isStringLiteral(arg)) {
          return;
        }

        visitSource(arg);
      }
    },
    // import.meta.resolve('<source>')
    MetaProperty(node) {
      if (node.meta.name !== 'import') {
        return;
      }
      if (node.property.name !== 'meta') {
        return;
      }
      const memberExpression = node.parent;
      if (memberExpression.type !== 'MemberExpression') {
        return;
      }
      if (memberExpression.property.type !== 'Identifier') {
        return;
      }
      if (memberExpression.property.name !== 'resolve') {
        return;
      }
      const callExpression = memberExpression.parent;
      if (callExpression.type !== 'CallExpression') {
        return;
      }
      const arg = callExpression.arguments.at(0);
      if (!isStringLiteral(arg)) {
        return;
      }

      visitSource(arg);
    },
    // export {...} from '<source>'
    ExportNamedDeclaration(node) {
      if (node.source == null) {
        return;
      }
      visitSource(node.source);
    },
    // export * ... from '<source>'
    ExportAllDeclaration(node) {
      visitSource(node.source);
    },
  };
}

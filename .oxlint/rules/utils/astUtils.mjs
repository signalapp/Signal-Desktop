// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @typedef {import("@typescript-eslint/utils").TSESTree.Node} Node
 * @typedef {import("@typescript-eslint/utils").TSESTree.Literal} Literal
 * @typedef {import("@typescript-eslint/utils").TSESTree.StringLiteral} StringLiteral
 * @typedef {import("@typescript-eslint/utils").TSESTree.Identifier} Identifier
 * @typedef {import("@typescript-eslint/utils").TSESTree.MemberExpression} MemberExpression
 */

/**
 * @param {Node=} node
 * @returns {node is StringLiteral}
 */
export function isStringLiteral(node) {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

/**
 * @param {Node | null | undefined} node
 * @param {string} property
 * @returns {node is MemberExpression}
 */
export function isPropertyAccess(node, property) {
  if (node?.type !== 'MemberExpression') {
    return false;
  }

  if (node.computed) {
    return node.property.type === 'Literal' && node.property.value === property;
  }

  return node.property.type === 'Identifier' && node.property.name === property;
}

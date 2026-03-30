// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

/**
 * @typedef {import("@typescript-eslint/utils").TSESTree.Identifier} Identifier
 * @typedef {import("@typescript-eslint/utils").TSESLint.SourceCode} SourceCode
 */

/**
 * @param {SourceCode} sourceCode
 * @param {Identifier} node
 */
export function getReferenceType(sourceCode, node) {
  const scope = sourceCode.getScope(node);
  const ref = scope.references.find(r => r.identifier === node);
  return ref?.resolved?.scope.type ?? null;
}

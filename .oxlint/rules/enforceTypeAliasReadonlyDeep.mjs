// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { assert } from './utils/assert.mjs';

/**
 * @typedef {import("@typescript-eslint/utils").TSESTree.Node} Node
 * @typedef {import("@typescript-eslint/utils").TSESLint.Scope.Scope} Scope
 */

/**
 * @param {Node} node
 * @param {Scope} scope
 */
function isReadOnlyDeep(node, scope) {
  if (node.type !== 'TSTypeReference') {
    return false;
  }

  const reference = scope.references.find(ref => {
    return ref.identifier === node.typeName;
  });

  const variable = reference?.resolved;
  if (variable == null) {
    return false;
  }

  const defs = variable.defs;
  if (defs.length !== 1) {
    return false;
  }

  const [def] = defs;
  assert(def, 'Missing def');

  return (
    def.type === 'ImportBinding' &&
    def.parent.type === 'ImportDeclaration' &&
    def.parent.source.type === 'Literal' &&
    def.parent.source.value === 'type-fest'
  );
}

export const enforceTypeAliasReadonlyDeep = ESLintUtils.RuleCreator.withoutDocs(
  {
    name: 'enforce-type-alias-readonlydeep',
    meta: {
      type: 'problem',
      messages: {
        needsReadonlyDeep:
          'Type aliases must be wrapped with ReadonlyDeep from type-fest',
      },
      schema: [],
      defaultOptions: [],
    },
    create(context) {
      return {
        TSTypeAliasDeclaration(node) {
          const scope = context.sourceCode.getScope(node);

          if (isReadOnlyDeep(node.typeAnnotation, scope)) {
            return;
          }

          context.report({
            node: node.id,
            messageId: 'needsReadonlyDeep',
          });
        },
      };
    },
  }
);

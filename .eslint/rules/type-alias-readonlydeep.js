// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

function isReadOnlyDeep(node, scope) {
  if (node.type !== 'TSTypeReference') {
    return false;
  }

  let reference = scope.references.find(reference => {
    return reference.identifier === node.typeName;
  });

  let variable = reference.resolved;
  if (variable == null) {
    return false;
  }

  let defs = variable.defs;
  if (defs.length !== 1) {
    return false;
  }

  let [def] = defs;

  return (
    def.type === 'ImportBinding' &&
    def.parent.type === 'ImportDeclaration' &&
    def.parent.source.type === 'Literal' &&
    def.parent.source.value === 'type-fest'
  );
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    hasSuggestions: false,
    fixable: false,
    schema: [],
  },
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        let scope = context.getScope(node);

        if (isReadOnlyDeep(node.typeAnnotation, scope)) {
          return;
        }

        context.report({
          node: node.id,
          message:
            'Type aliases must be wrapped with ReadonlyDeep from type-fest',
        });
      },
    };
  },
};

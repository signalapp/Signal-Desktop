// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
export default function transform(babel) {
  const { types: t } = babel;

  return {
    visitor: {
      CallExpression(path) {
        const { node } = path;
        if (node.arguments.length !== 1) {
          return;
        }
        if (node.callee.type !== 'MemberExpression') {
          return;
        }
        const { object, property } = node.callee;
        if (object.type !== 'Identifier' || object.name !== 'Long') {
          return;
        }
        if (property.type !== 'Identifier') {
          return;
        }

        if (property.name === 'isLong') {
          path.replaceWith(
            t.BinaryExpression(
              '===',
              t.UnaryExpression('typeof', node.arguments[0]),
              t.StringLiteral('bigint')
            )
          );
          return;
        }

        if (
          property.name !== 'fromNumber' &&
          property.name !== 'fromString' &&
          property.name !== 'fromValue'
        ) {
          return;
        }

        if (node.arguments[0].type === 'NumericLiteral') {
          path.replaceWith(t.BigIntLiteral(node.arguments[0].value.toString()));
          return;
        }
        path.replaceWith(
          t.CallExpression(t.Identifier('BigInt'), [node.arguments[0]])
        );
      },
    },
  };
}

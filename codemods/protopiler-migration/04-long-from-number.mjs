// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

export default declare(function transform(babel) {
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
          const [arg] = node.arguments;
          if (!t.isExpression(arg)) {
            throw path.buildCodeFrameError(
              'First argument to isLong must be an expression'
            );
          }
          path.replaceWith(
            t.binaryExpression(
              '===',
              t.unaryExpression('typeof', arg),
              t.stringLiteral('bigint')
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

        const [arg] = node.arguments;
        if (arg == null) {
          throw path.buildCodeFrameError(
            `Missing first argument to ${property.name}`
          );
        }

        if (arg.type === 'NumericLiteral') {
          path.replaceWith(t.bigIntLiteral(arg.value.toString()));
          return;
        }
        path.replaceWith(t.callExpression(t.identifier('BigInt'), [arg]));
      },
    },
  };
});

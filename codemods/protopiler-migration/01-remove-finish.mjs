// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

export default declare(function transform() {
  return {
    visitor: {
      CallExpression(path) {
        const { node } = path;
        if (node.arguments.length !== 0) {
          return;
        }
        if (node.callee.type !== 'MemberExpression') {
          return;
        }
        const { object, property } = node.callee;
        if (object.type !== 'CallExpression') {
          return;
        }

        if (property.type !== 'Identifier' || property.name !== 'finish') {
          return;
        }

        if (
          object.callee.type !== 'MemberExpression' ||
          object.callee.property.type !== 'Identifier' ||
          object.callee.property.name !== 'encode'
        ) {
          return;
        }

        path.replaceWith(object);
      },
    },
  };
});

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

export default declare(function transform(babel) {
  const { types: t } = babel;

  return {
    visitor: {
      TSQualifiedName(path) {
        const { node } = path;
        if (
          node.right.type !== 'Identifier' ||
          !/^I[A-Z][a-z]/.test(node.right.name)
        ) {
          return;
        }

        // Don't touch fuse.js
        if (node.left.type === 'Identifier' && node.left.name === 'Fuse') {
          return;
        }

        path.replaceWith(
          t.tsQualifiedName(
            t.tsQualifiedName(
              node.left,
              t.identifier(node.right.name.slice(1))
            ),
            t.identifier('Params')
          )
        );
      },
    },
  };
});

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
export default function transform(babel) {
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
          t.TSQualifiedName(
            t.TSQualifiedName(
              node.left,
              t.Identifier(node.right.name.slice(1))
            ),
            t.Identifier('Params')
          )
        );
      },
    },
  };
}

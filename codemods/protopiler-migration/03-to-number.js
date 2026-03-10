// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { relative, dirname, join } from 'node:path';

const importPath = join(__dirname, '..', 'ts', 'util', 'toNumber.std.js');

export default function transform(babel) {
  const { types: t } = babel;

  let program;
  function Program({ node }) {
    program = node;
  }

  function addImport(filename) {
    if (program === undefined) {
      return;
    }

    let index = program.body.findLastIndex(
      stmt => stmt.type === 'ImportDeclaration'
    );
    if (index === -1) {
      index = 0;
    } else {
      index += 1;
    }
    let relativePath = relative(dirname(filename), importPath);
    if (!relativePath.startsWith('.')) {
      relativePath = `./${relativePath}`;
    }
    program.body.splice(
      index,
      0,
      t.ImportDeclaration(
        [t.ImportSpecifier(t.Identifier('toNumber'), t.Identifier('toNumber'))],
        t.StringLiteral(relativePath)
      )
    );
    program = undefined;
  }

  function CallExpression(path, { filename }) {
    const { callee, arguments: args } = path.node;
    if (args.length !== 0) {
      return;
    }
    if (
      callee.type !== 'MemberExpression' &&
      callee.type !== 'OptionalMemberExpression'
    ) {
      return;
    }
    if (
      callee.property.type !== 'Identifier' ||
      callee.property.name !== 'toNumber'
    ) {
      return;
    }

    const replacement = t.CallExpression(t.Identifier('toNumber'), [
      callee.object,
    ]);
    path.replaceWith(replacement);
    addImport(filename);
  }

  return {
    visitor: {
      Program,
      CallExpression,
      OptionalCallExpression: CallExpression,
    },
  };
}

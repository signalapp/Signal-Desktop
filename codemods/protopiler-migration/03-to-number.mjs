// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';
import { relative, dirname, join } from 'node:path';

/** @import { NodePath, types as t, PluginPass } from '@babel/core' */

const importPath = join(
  import.meta.dirname,
  '..',
  'ts',
  'util',
  'toNumber.std.js'
);

export default declare(function transform(babel) {
  const { types: t } = babel;

  /** @type {t.Program | undefined} */
  let program;

  /**
   * @param {NodePath<t.Program>} path
   */
  function Program({ node }) {
    program = node;
  }

  /**
   * @param {string} filename
   */
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
      t.importDeclaration(
        [t.importSpecifier(t.identifier('toNumber'), t.identifier('toNumber'))],
        t.stringLiteral(relativePath)
      )
    );
    program = undefined;
  }

  /**
   * @param {NodePath<t.CallExpression | t.OptionalCallExpression>} path
   * @param {PluginPass} plugin
   */
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

    const replacement = t.callExpression(t.identifier('toNumber'), [
      callee.object,
    ]);
    path.replaceWith(replacement);
    if (filename == null) {
      throw path.buildCodeFrameError('Missing filename');
    }
    addImport(filename);
  }

  return {
    visitor: {
      Program,
      CallExpression,
      OptionalCallExpression: CallExpression,
    },
  };
});

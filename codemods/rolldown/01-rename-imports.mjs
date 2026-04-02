// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** @import { NodePath, types as t, PluginPass } from '@babel/core' */

export default declare(function transform() {
  /**
   * @param {NodePath<t.ImportDeclaration | t.ExportAllDeclaration | t.ExportNamedDeclaration>} path
   * @param {PluginPass} plugin
   */
  function ImportOrExport(path, { filename }) {
    const { node } = path;
    if (filename == null) {
      throw path.buildCodeFrameError('Missing filename');
    }

    if (
      !node.source ||
      !node.source.value.startsWith('.') ||
      !node.source.value.endsWith('.js') ||
      // js file with .d.ts file
      node.source.value.endsWith('/StorybookThemeContext.std.js') ||
      // protobuf
      node.source.value.endsWith('/compiled.std.js')
    ) {
      return;
    }

    const ts = node.source.value.replace(/\.js$/, '.ts');
    const tsx = node.source.value.replace(/\.js$/, '.tsx');
    const dts = node.source.value.replace(/\.js$/, '.d.ts');
    const dir = dirname(filename);

    if (existsSync(join(dir, ts))) {
      node.source.value = ts;
    } else if (existsSync(join(dir, tsx))) {
      node.source.value = tsx;
    } else if (existsSync(join(dir, dts))) {
      node.source.value = dts;
    } else {
      throw new Error(`File not found: ${join(dir, node.source.value)}`);
    }
  }

  return {
    visitor: {
      ImportDeclaration: ImportOrExport,
      ExportAllDeclaration: ImportOrExport,
      ExportNamedDeclaration: ImportOrExport,
    },
  };
});

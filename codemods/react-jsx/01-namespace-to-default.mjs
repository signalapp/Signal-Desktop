// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

/**
 * Replaces React namespace imports with default imports
 *
 * ```diff
 * - import * as React from 'react';
 * + import React from 'react';
 * ```
 */
export default declare(function transform({ types: t }) {
  return {
    visitor: {
      ImportDeclaration(path) {
        // Ignore non-react imports
        if (path.node.source.value !== 'react') {
          return;
        }

        // Ignore type imports, we dont even have any
        if (path.node.importKind === 'type') {
          return;
        }

        // Check if there's a namespace import
        const specifiers = path.get('specifiers');
        const namespaceSpecifier = specifiers.find(specifier => {
          return specifier.isImportNamespaceSpecifier();
        });
        if (namespaceSpecifier == null) {
          return;
        }

        // If there is, replace it with a default import specifier with the
        // same name (ex: "React")
        namespaceSpecifier.replaceWith(
          t.importDefaultSpecifier(namespaceSpecifier.node.local)
        );
      },
    },
  };
});

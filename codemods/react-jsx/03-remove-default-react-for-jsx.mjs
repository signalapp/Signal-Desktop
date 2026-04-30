// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

/**
 * Removed React default imports that are not referenced anywhere.
 *
 * ```diff
 * - import React, { useMemo } from 'react';
 * + import { useMemo } from 'react';
 * ```
 *
 * Removing the entire import declaration was also removing license comments so
 * we leave the import in place and just find-and-replace this line after.
 *
 * ```diff
 * - import React from 'react';
 * + import 'react';
 * ```
 */
export default declare(function transform() {
  return {
    visitor: {
      ImportDeclaration(path) {
        // Ignore non-react imports
        if (path.node.source.value !== 'react') {
          return;
        }

        // Ignore type imports, dont have any anyways
        if (path.node.importKind === 'type') {
          return;
        }

        // Ignore if there's no default specifier
        const specifiers = path.get('specifiers');
        const defaultSpecifier = specifiers.find(specifier => {
          return specifier.isImportDefaultSpecifier();
        });
        if (defaultSpecifier == null) {
          return;
        }

        // Ignore if there are still references to the binding
        const localName = defaultSpecifier.node.local.name;
        const binding = path.scope.getBinding(localName);
        if (binding?.referenced) {
          return;
        }

        // Remove the default import
        if (specifiers.length === 1) {
          // Can't call remove without deleting a lot of leading license comments
          // path.remove();
          defaultSpecifier.remove();
        } else {
          defaultSpecifier.remove();
        }
      },
    },
  };
});

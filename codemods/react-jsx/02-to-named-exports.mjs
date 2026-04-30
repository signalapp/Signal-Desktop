// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

/**
 * Replace member expressions like `React.exportName` to named imports,
 * using existing import specifiers if available.
 *
 * ```diff
 * - import React, { useCallback } from 'react';
 * + import { useMemo, useCallback } from 'react';
 *
 *   // Replace member expression with named import
 * - React.useMemo()
 * + useMemo()
 *
 *   // Leave existing named imports alone
 *   useCallback()
 *
 *   // Re-use existing named imports with the same name:
 * - React.useCallback()
 * + useCallback()
 * ```
 *
 * Note: This was also trying to replace "qualified type identifiers"
 * but @codemod/cli isn't setup to find type references for some reason so
 * 04-fix-type-references.mjs was added to clean that up.
 */
export default declare(function transform({ types: t }) {
  return {
    visitor: {
      ImportDeclaration(path) {
        // Ignore non-react imports
        if (path.node.source.value !== 'react') {
          return;
        }

        // (Mistake) Ignore type imports. Should have considered these
        // but other linting managed to fix it up.
        if (path.node.importKind === 'type') {
          return;
        }

        const specifiers = path.get('specifiers');

        // If there's no default export we don't need to do anything
        const defaultSpecifier = specifiers.find(specifier => {
          return specifier.isImportDefaultSpecifier();
        });
        if (defaultSpecifier == null) {
          return;
        }

        // Collect the named specifiers so we don't recreate them
        const namedSpecifiers = specifiers.filter(specifier => {
          return specifier.isImportSpecifier();
        });

        // Get the binding so we can find all of its references
        const defaultLocalName = defaultSpecifier.node.local.name;
        const binding = path.scope.getBinding(defaultLocalName);
        if (binding == null) {
          throw path.buildCodeFrameError('Missing binding');
        }

        // If there are no references we can delete the import later
        if (!binding.referenced) {
          return;
        }

        // Collect all the names we'll need specifiers for and track if
        // they should be value or type imports. We may need to convert
        // existing type imports to value imports
        const names = new Map();
        const usedAsValue = new Set();
        const usedAsType = new Set();

        for (const namedSpecifier of namedSpecifiers) {
          // Ignore string literal specifiers, we dont have any
          if (namedSpecifier.node.imported.type !== 'Identifier') {
            throw namedSpecifier.buildCodeFrameError('Expected an identifer');
          }

          const importedName = namedSpecifier.node.imported.name;
          const localName = namedSpecifier.node.local.name;

          // Started trying to handle renamed imports but didn't encounter any
          // so just asserted it here
          if (importedName !== localName) {
            throw namedSpecifier.buildCodeFrameError(
              'Expected to be the same name'
            );
          }

          // Track how we're currently using the import
          if (namedSpecifier.node.importKind === 'type') {
            usedAsType.add(importedName);
          } else {
            usedAsValue.add(importedName);
          }

          // Save the name for later so we don't duplicate it
          names.set(importedName, localName);
        }

        // Now go through all references to update them from member expressions
        // or qualified type identifiers and eagerly update them to the named
        // imports we'll add later.
        for (const refPath of binding.referencePaths) {
          const parentPath = refPath.parentPath;

          // This should never happen
          if (parentPath == null) {
            throw refPath.buildCodeFrameError('Missing parentPath');
          }

          // `React.useMemo()` -> `useMemo()`
          if (parentPath.isMemberExpression()) {
            const member = parentPath.node.property;

            // Ignore `React["useMemo"]`
            if (member.type !== 'Identifier') {
              throw refPath.buildCodeFrameError('Expected identifer');
            }

            // Make sure we add a specifier for later
            const importedName = member.name;
            if (!names.has(importedName)) {
              names.set(importedName, importedName);
            }

            // We need the specifier to be a value
            usedAsValue.add(importedName);

            // Update member expression to a simple identifier
            parentPath.replaceWith(member);
            continue;
          }

          // `<React.Fragment>` -> `<Fragment>`
          if (parentPath.isJSXMemberExpression()) {
            const member = parentPath.node.property;

            // Make sure we add a specifier for later
            const importedName = member.name;
            if (!names.has(importedName)) {
              names.set(importedName, importedName);
            }

            // We need the specifier to be a value
            usedAsValue.add(importedName);

            // Update jsx member expression to a simple jsx identifier
            parentPath.replaceWith(member);
            continue;
          }

          // `React.JSX.Element` -> `JSX.Element`
          if (parentPath.isQualifiedTypeIdentifier()) {
            const member = parentPath.node.id;

            // Make sure we add a specifier for later
            const importedName = member.name;
            if (!names.has(importedName)) {
              names.set(importedName, importedName);
            }

            // We need the specifier to be a type
            usedAsType.add(importedName);

            // Update qualfied type id to a type id
            parentPath.replaceWith(parentPath.node.id);
            continue;
          }

          throw refPath.buildCodeFrameError('Unhandled case');
        }

        // Construct new specifiers out of the info we've collected
        const newSpecifiers = [];
        for (const [importedName, localName] of names) {
          const specifier = t.importSpecifier(
            t.identifier(importedName),
            t.identifier(localName)
          );

          if (usedAsValue.has(importedName)) {
            specifier.importKind = 'value';
          } else if (usedAsType.has(importedName)) {
            specifier.importKind = 'type';
          } else {
            throw path.buildCodeFrameError(
              `Import not used as value or type: ${importedName}`
            );
          }

          newSpecifiers.push(specifier);
        }

        // Finally update the import declaration with all new specifiers:

        // Using replaceWith() was causing comments to be lost
        // oxlint-disable-next-line no-param-reassign
        path.node.specifiers = newSpecifiers;
      },
    },
  };
});

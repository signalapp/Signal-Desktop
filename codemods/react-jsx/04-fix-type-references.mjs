// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { declare } from '@babel/helper-plugin-utils';

/**
 * @import { types as t, PluginObj, PluginPass } from '@babel/core'
 */

/**
 * Update references to `React.*` in types that were missed by 02-to-named-exports.mjs
 *
 * ```diff
 * - import { useMemo } from 'react';
 * + import { useMemo, type JSX } from 'react';
 *
 * - type X = React.JSX.Element
 * + type X = JSX.Element
 * ```
 */
export default declare(function transform({ types: t }) {
  /**
   * @typedef {PluginPass & {
   *   existingSpecifiers?: Set<string>,
   *   reactImportNode?: t.ImportDeclaration | null,
   * }} State
   */

  /** @type {PluginObj<State>} */
  return {
    // Setup state for the transform, we don't want to re-import
    // imports/specifiers that we already import, so we use this state to track
    // what has been added and which import declaration we need to add to.
    pre() {
      /** @type {Set<string>} */
      this.existingSpecifiers = new Set();
      this.reactImportNode = null;
    },

    visitor: {
      // Visit all import declarations first to collect all of the existing
      // import specifiers before we start adding new ones
      ImportDeclaration(path) {
        // Ignore non-react imports
        if (path.node.source.value !== 'react') {
          return;
        }

        // Make typescript happy
        if (this.existingSpecifiers == null) {
          throw new Error('Missing state');
        }
        const existingSpecifiers = this.existingSpecifiers;

        // Iterate through each specifier and add it to `existingSpecifiers`
        for (const specifier of path.node.specifiers) {
          // Ignore default and namespace imports
          if (specifier.type !== 'ImportSpecifier') {
            continue;
          }

          // Ignore string literal imports, we dont have any
          if (specifier.imported.type !== 'Identifier') {
            throw path.buildCodeFrameError('Expected identifier');
          }

          const importedName = specifier.imported.name;
          const localName = specifier.local.name;

          // Assert we're not doing a rename to keep this codemod simpler
          if (importedName !== localName) {
            throw path.buildCodeFrameError(
              `Expected "${localName}" === "${importedName}"`
            );
          }

          // Save the specifier so we don't re-add it
          existingSpecifiers.add(importedName);
        }

        // Store which import node we want to add to
        if (
          // Prefer earlier imports
          this.reactImportNode == null ||
          // Prefer type import
          (this.reactImportNode.importKind !== 'type' &&
            path.node.importKind === 'type')
        ) {
          this.reactImportNode = path.node;
        }
      },

      // Check identifier for `React.*` type references.
      Identifier(path, pluginPass) {
        // We're looking for a "React" global, but skip the check to see what
        // it is referencing since we messed up the earlier codemod. Manually
        // grepped for any references to React that werent a know export of
        // react
        if (path.node.name !== 'React') {
          return;
        }

        // Make TS happy
        if (this.existingSpecifiers == null) {
          throw new Error('Missing state');
        }
        const existingSpecifiers = this.existingSpecifiers;

        // Ignore if we're not a type reference. "TSQualfiedName" is basically
        // a member expression in typescript.
        const qualifiedName = path.parentPath;
        if (!qualifiedName.isTSQualifiedName()) {
          return;
        }

        // Get the member name we need to import
        const memberName = qualifiedName.node.right.name;

        // Replace `React.*` with `*`
        qualifiedName.replaceWith(t.identifier(memberName));

        // Already have import specifier
        if (existingSpecifiers.has(memberName)) {
          return;
        }

        // Make sure we don't re-add it again in the same file
        existingSpecifiers.add(memberName);

        const specifier = t.importSpecifier(
          t.identifier(memberName),
          t.identifier(memberName)
        );

        // Already have an import declaration we can just push to
        if (this.reactImportNode != null) {
          // Only mark the specifier as a 'type' if the import declaration is not already
          if (this.reactImportNode.importKind !== 'type') {
            specifier.importKind = 'type';
          }
          this.reactImportNode.specifiers.push(specifier);
          return;
        }

        // Otherwise create a new import declaration
        const importDecl = t.importDeclaration(
          [specifier],
          t.stringLiteral('react')
        );

        // Since its new we can just make the entire thing a 'type' import
        importDecl.importKind = 'type';

        // Look up the first statement in the program so we can copy comments
        // off of it
        const programPath = pluginPass.file.path;
        const [firstStatement] = programPath.get('body');

        if (firstStatement) {
          // Babel uses `node.leadingComments/trailingComments/innerComments`
          // but recast uses `node.comments`, both exist on the ast nodes, but
          // since recast is doing the printing we need to use `node.comments`
          //
          // ...I wish I knew this in earlier codemods...

          // @ts-expect-error
          importDecl.comments = firstStatement.node.comments;
          // @ts-expect-error
          firstStatement.node.comments = null;

          // Insert the declaration before the first statement
          firstStatement.insertBefore(importDecl);
        } else {
          // This will never happen, but if the program has no statements then
          // this handles that, I don't know why I bothered
          programPath.unshiftContainer('body', importDecl);
        }

        this.reactImportNode = importDecl;
      },
    },
  };
});

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { ESLintUtils } from '@typescript-eslint/utils';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { isBuiltin, findPackageJSON } from 'node:module';
import { createImportSourceVisitor } from './utils/createImportSourceVisitor.mjs';

/**
 * @param value {unknown}
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value != null;
}

/**
 * @param deps {unknown}
 */
function getDepsKeys(deps) {
  return new Set(isObject(deps) ? Object.keys(deps) : null);
}

/**
 * @param deps {unknown}
 * @returns {Set<string>}
 */
function getBundledDepsKeys(deps) {
  return Array.isArray(deps) ? new Set(deps) : getDepsKeys(deps);
}

/**
 * @typedef {object} PkgDeps
 * @property {Set<string>} dependencies
 * @property {Set<string>} devDependencies
 * @property {Set<string>} peerDependencies
 * @property {Set<string>} optionalDependencies
 * @property {Set<string>} bundledDependencies
 */

/** @type {Map<string, PkgDeps>} */
const PKG_DEPS_CACHE = new Map();

/** @param {string} currentFile */
function getPkgDeps(currentFile) {
  const currentDir = dirname(currentFile);

  const cached = PKG_DEPS_CACHE.get(currentDir);
  if (cached != null) {
    return cached;
  }

  const pkgPath = findPackageJSON('.', currentFile);
  if (pkgPath == null) {
    throw new Error(`Could not resolve package.json from ${currentFile}`);
  }
  const pkgText = readFileSync(pkgPath, 'utf8');
  const pkgJson = JSON.parse(pkgText);

  /** @type {PkgDeps} */
  const pkgDeps = {
    dependencies: getDepsKeys(pkgJson.dependencies),
    devDependencies: getDepsKeys(pkgJson.devDependencies),
    peerDependencies: getDepsKeys(pkgJson.peerDependencies),
    optionalDependencies: getDepsKeys(pkgJson.optionalDependencies),
    bundledDependencies: getBundledDepsKeys(pkgJson.bundledDependencies),
  };

  PKG_DEPS_CACHE.set(currentDir, pkgDeps);

  return pkgDeps;
}

/** @param {string} source */
function getPackageNameFromSource(source) {
  if (source.startsWith('@')) {
    const [scope, name] = source.split('/', 2);
    return `${scope}/${name}`;
  }
  const [name] = source.split('/', 1);
  return name;
}

/**
 * @typedef {object} Options
 * @property {boolean=} devDependencies
 * @property {boolean=} peerDependencies
 * @property {boolean=} optionalDependencies
 * @property {boolean=} bundledDependencies
 */

/** @type {[Options]} */
const defaultOptions = [
  {
    devDependencies: true,
    peerDependencies: true,
    optionalDependencies: true,
    bundledDependencies: true,
  },
];

export const noExtraneousDependencies = ESLintUtils.RuleCreator.withoutDocs({
  name: 'no-extraneous-dependencies',
  meta: {
    type: 'problem',
    messages: {
      missingFromProjectDeps:
        "'{{pkgName}}' should be listed in the project's dependencies",
      wrongProjectDeps:
        "'{{pkgName}}' should be listed in the project's dependencies, found in {{found}}",
    },
    schema: [
      {
        type: 'object',
        properties: {
          devDependencies: { type: 'boolean' },
          peerDependencies: { type: 'boolean' },
          optionalDependencies: { type: 'boolean' },
          bundledDependencies: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions,
  },
  create(context) {
    const { sourceCode, options } = context;

    const opts = {
      devDependencies: options[0]?.devDependencies ?? true,
      peerDependencies: options[0]?.peerDependencies ?? true,
      optionalDependencies: options[0]?.optionalDependencies ?? true,
      bundledDependencies: options[0]?.bundledDependencies ?? true,
    };

    const pkgDeps = getPkgDeps(context.physicalFilename);

    return createImportSourceVisitor(sourceCode, node => {
      const source = node.value;

      if (
        source.startsWith('.') ||
        source.startsWith('/') ||
        source.trim() === ''
      ) {
        return;
      }

      if (isBuiltin(source)) {
        return;
      }

      const pkgName = getPackageNameFromSource(source);

      /** @type {Array<string>} */
      const found = [];

      if (pkgDeps.dependencies.has(pkgName)) {
        return;
      }
      if (pkgDeps.devDependencies.has(pkgName)) {
        found.push('devDependencies');
        if (opts.devDependencies) {
          return;
        }
      }
      if (pkgDeps.peerDependencies.has(pkgName)) {
        found.push('peerDependencies');
        if (opts.peerDependencies) {
          return;
        }
      }
      if (pkgDeps.optionalDependencies.has(pkgName)) {
        found.push('optionalDependencies');
        if (opts.optionalDependencies) {
          return;
        }
      }
      if (pkgDeps.bundledDependencies.has(pkgName)) {
        found.push('bundledDependencies');
        if (opts.bundledDependencies) {
          return;
        }
      }

      if (found.length > 0) {
        context.report({
          node,
          messageId: 'wrongProjectDeps',
          data: { pkgName, found: found.join(', ') },
        });
      } else {
        context.report({
          node,
          messageId: 'missingFromProjectDeps',
          data: { pkgName },
        });
      }
    });
  },
});

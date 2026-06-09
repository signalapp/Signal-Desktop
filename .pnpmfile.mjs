// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

//
// WARNING: Do not import (or even `import()`) any packages, they won't always be installed.
//

import { execSync } from 'node:child_process';
import { styleText } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * From @pnpm/pnpmfile/lib/Hooks.d.ts
 *
 * @typedef {{
 *   deprecated?: boolean;
 * }} PackageSnapshot
 *
 * @typedef {Record<string, PackageSnapshot>} PackageSnapshots
 *
 * @typedef {{
 *   packages?: PackageSnapshots
 * }} LockfileObject
 *
 * @typedef {{
 *   log: (message: string) => void;
 * }} HookContext
 *
 * @typedef {{
 *   verifyDepsBeforeRun?: unknown,
 * }} Config
 *
 * @typedef {{
 *   afterAllResolved?: (
 *     lockfile: LockfileObject,
 *     context: HookContext,
 *   ) => LockfileObject | Promise<LockfileObject>;
 *   updateConfig?: (config: Config) => Config | Promise<Config>
 * }} Hooks
 */

/**
 * @param {boolean} condition
 * @param {string} message
 * @returns {asserts condition}
 */
// function assert(condition, message) {
//   if (!condition) {
//     throw new TypeError(message);
//   }
// }

/**
 * @param {string} message
 */
function formatError(message) {
  return `${styleText(['bgRed', 'whiteBright'], '[ERROR]')} ${styleText('red', message)}`;
}

/** @type {any} */
let CACHED_WORKSPACE_CONFIG;
async function getWorkspaceConfig() {
  if (CACHED_WORKSPACE_CONFIG == null) {
    const stdout = execSync('pnpm config list --json', {
      encoding: 'utf-8',
      env: { PATH: process.env.PATH },
    });
    const config = JSON.parse(stdout);
    CACHED_WORKSPACE_CONFIG = config;
  }
  return CACHED_WORKSPACE_CONFIG;
}

/**
 * Samples:
 * - "jest-process-manager@0.4.0"
 * - "@jest/process-manager@0.4.0"
 * - "jest-process-manager@0.4.0(debug@4.4.3)"
 *
 * @param {string} packagePath
 */
function parsePackagePath(packagePath) {
  const truncateAt = packagePath.indexOf('(');
  const packageSpec =
    truncateAt === -1 ? packagePath : packagePath.slice(0, truncateAt);

  const splitAt = packageSpec.lastIndexOf('@');
  const name = packageSpec.slice(0, splitAt);
  const version = packageSpec.slice(splitAt + 1);

  return { name, version };
}

/**
 * @typedef {{
 *   path: string,
 *   name: string,
 *   version: string,
 *   snapshot: PackageSnapshot,
 * }} PackageSnapshotEntry
 */

/**
 * @param {LockfileObject} lockfile
 * @returns {ReadonlyArray<PackageSnapshotEntry>}
 */
function getPackages(lockfile) {
  const { packages = {} } = lockfile;
  return Object.keys(packages).map(path => {
    const snapshot = packages[path];
    const { name, version } = parsePackagePath(path);
    return { path, name, version, snapshot };
  });
}

/**
 * Minimal semver support, only supports exact versions and `||`
 * @param {string} version
 * @param {string} range
 */
function satisfies(version, range) {
  return range.split('||').some(choice => {
    return choice.trim() === version;
  });
}

/**
 * @typedef {(lockfile: LockfileObject, context: HookContext) => Promise<boolean>} CustomCheck
 */

/** @type {CustomCheck} */
async function noDeprecatedPackages(lockfile, context) {
  const config = await getWorkspaceConfig();
  const packages = getPackages(lockfile);

  const deprecated = packages.filter(pkg => {
    if (!pkg.snapshot.deprecated) {
      return false;
    }
    const allowed = config.allowedDeprecatedVersions?.[pkg.name];
    if (allowed != null && satisfies(pkg.version, allowed)) {
      return false;
    }
    return true;
  });

  const success = deprecated.length === 0;

  if (!success) {
    context.log('');
    context.log(
      formatError(
        'Found deprecated packages, to ignore them add this to the pnpm-workspace.yaml file:'
      )
    );
    context.log('');
    context.log('allowedDeprecatedVersions:');
    for (const pkg of deprecated) {
      context.log(`  '${pkg.name}': '${pkg.version}'`);
    }
    context.log('');
  }

  return success;
}

/** @type {ReadonlyArray<RegExp>} */
const RESTRICTED_DUPLICATE_DEPENDENCIES = [
  // /^@signalapp\//,
  // /^@indutny\//,
];

/**
 * @param {string} name
 * @returns {boolean}
 */
function isRestrictedDuplicateDependency(name) {
  return RESTRICTED_DUPLICATE_DEPENDENCIES.some(regex => {
    return regex.test(name);
  });
}

/** @type {CustomCheck} */
async function restrictDuplicateDependencies(lockfile, context) {
  const packages = getPackages(lockfile);

  /** @type {Map<string, Set<string>>} */
  const seen = new Map();
  /** @type {Set<string>} */
  const duplicates = new Set();

  for (const pkg of packages) {
    if (!isRestrictedDuplicateDependency(pkg.name)) {
      continue;
    }

    let versions = seen.get(pkg.name);
    if (versions != null) {
      duplicates.add(pkg.name);
    } else {
      versions = new Set();
      seen.set(pkg.name, versions);
    }
    versions.add(pkg.version);
  }

  const success = duplicates.size === 0;

  if (!success) {
    context.log('');
    context.log(formatError('Found duplicate restricted packages:'));
    context.log('');

    for (const duplicate of duplicates) {
      const versions = seen.get(duplicate);
      assert(versions != null, `Missing package versions for ${duplicate}`);
      context.log(`  ${duplicate}: ${Array.from(versions).join(', ')}`);
    }
    context.log('');
  }

  return success;
}

/** @type {Hooks} */
export const hooks = {
  async afterAllResolved(lockfile, context) {
    const results = await Promise.all([
      noDeprecatedPackages(lockfile, context),
      restrictDuplicateDependencies(lockfile, context),
    ]);

    const hasAnyFailures = results.includes(false);
    if (hasAnyFailures) {
      context.log(
        formatError(
          'pnpm install failed because of a custom check in .pnpmfile.mjs'
        )
      );
      context.log('');
      process.exit(1);
    }

    return lockfile;
  },

  updateConfig(config) {
    return {
      ...config,
      verifyDepsBeforeRun:
        process.env.CI || process.env.SKIP_VERIFY_DEPS_BEFORE_RUN
          ? false
          : config.verifyDepsBeforeRun,
    };
  },
};

if (process.env.NODE_TEST_CONTEXT) {
  await test('noDeprecatedPackages', async () => {
    const pkg = '@scope/pkg-name@1.0.0(@other-scope/other-pkg@2.0.0)';
    const success = await noDeprecatedPackages(
      { packages: { [pkg]: { deprecated: true } } },
      { log: () => undefined }
    );
    assert(!success);
  });
}

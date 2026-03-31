// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { fail } from '../danger-exports.mjs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import * as semver from 'semver';

const rootDir = resolve(import.meta.dirname, '..', '..');
const pkgPath = resolve(rootDir, 'package.json');
const pkgContents = readFileSync(pkgPath, 'utf8');
const pkgJson = JSON.parse(pkgContents);

const depTypes = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

/**
 * @param {string} depSpec
 * @returns {boolean}
 */
function isPinnedVersion(depSpec) {
  if (depSpec.startsWith('https:')) {
    return depSpec.includes('#');
  }
  /** @type {string} */
  let version;
  if (depSpec.startsWith('workspace:')) {
    version = depSpec.replace(/^workspace:/, '');
  } else {
    version = depSpec;
  }
  return semver.valid(version) != null;
}

for (const depType of depTypes) {
  const deps = pkgJson[depType];
  if (deps == null) {
    continue;
  }

  for (const [depName, depSpec] of Object.entries(deps)) {
    if (typeof depSpec === 'string' && !isPinnedVersion(depSpec)) {
      fail(
        `**Pin package.json versions**\n` +
          `All package.json versions should be pinned to a specific version.\n` +
          `See ${depName}@${depSpec} in package.json#${depType}.`,
        'package.json'
      );
    }
  }
}

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { fail } from '../danger-exports.mjs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import * as YAML from 'js-yaml';

const rootDir = resolve(import.meta.dirname, '..', '..');
const pkgPath = resolve(rootDir, 'package.json');
const pkgContents = readFileSync(pkgPath, 'utf8');
const pkgJson = JSON.parse(pkgContents);

const lockPath = resolve(rootDir, 'pnpm-lock.yaml');
const lockContents = readFileSync(lockPath, 'utf8');
/** @type {any} */
const lockYaml = YAML.load(lockContents);

const expectedVersion = pkgJson.devDependencies.tailwindcss;
if (typeof expectedVersion !== 'string') {
  throw new TypeError('Missing tailwindcss package version');
}

/**
 * @param {string} pkgName
 * @returns {boolean}
 */
function isTailwindPackage(pkgName) {
  return pkgName === 'tailwindcss' || pkgName.startsWith('@tailwindcss/');
}

for (const depType of ['dependencies', 'devDependencies']) {
  for (const [depName, depSpec] of Object.entries(pkgJson[depType])) {
    if (typeof depSpec !== 'string') {
      throw new TypeError(
        `Expected string value for "${depName}" in package.json#${depType}`
      );
    }
    if (isTailwindPackage(depName) && depSpec !== expectedVersion) {
      fail(
        `**Tailwind package versions must all match**\n` +
          `Expected to match tailwindcss@${expectedVersion}\n` +
          `See ${depName}@${depSpec} in package.json#${depType}.`,
        'package.json'
      );
    }
  }
}

for (const depKey of Object.keys(lockYaml.packages)) {
  const match = depKey.match(/^((?:@[^\/]+\/)?[^@]+)@(.+)$/);
  if (match == null) {
    throw new Error(`Could not parse "${depKey}"`);
  }

  const [, depName, depSpec] = match;

  if (isTailwindPackage(depName) && depSpec !== expectedVersion) {
    fail(
      `**Tailwind package versions must all match**\n` +
        `Expected to match tailwindcss@${expectedVersion}\n` +
        `See ${depName}@${depSpec} in pnpm-lock.yaml#packages.`,
      'pnpm-lock.yaml'
    );
  }
}

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { fail } from '../danger-exports.mjs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import * as YAML from 'js-yaml';

const rootDir = resolve(import.meta.dirname, '..', '..');
const lockPath = resolve(rootDir, 'pnpm-lock.yaml');
const lockContents = readFileSync(lockPath, 'utf8');
/** @type {any} */
const lockYaml = YAML.load(lockContents);

for (const name of Object.keys(lockYaml.packages)) {
  const spec = lockYaml.packages[name];

  if (spec.resolution?.integrity == null) {
    fail(
      `**Dependency resolution missing integrity**\n` +
        `All dependencies should have a resolution with an integrity field.\n` +
        `You may need to override it or provide it manually.\n` +
        `\n` +
        `See "${name}".`,
      'pnpm-lock.yaml'
    );
  }
}

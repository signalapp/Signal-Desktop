// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PackageJsonType } from '../types/packageJson.d.ts';

// oxlint-disable-next-line no-restricted-globals
const PACKAGE_JSON_PATH = join(__dirname, '..', '..', 'package.json');

export const packageJson: PackageJsonType = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, 'utf8')
);

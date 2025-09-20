// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_JSON_PATH = join(__dirname, '..', '..', 'package.json');

const json: {
  name: string;
  version: string;
  productName: string;
  build: {
    appId: string;
  };
} = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));

export default json;

export const { name } = json;
export const { version } = json;
export const { productName } = json;
export const { build } = json;

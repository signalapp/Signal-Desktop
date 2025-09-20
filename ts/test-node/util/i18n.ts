// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setupI18n } from '../../util/setupI18n.js';

const PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '_locales',
  'en',
  'messages.json'
);

export const enMessages = JSON.parse(readFileSync(PATH, 'utf8'));

export default setupI18n('en', enMessages);

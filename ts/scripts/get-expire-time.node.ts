// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { DAY } from '../util/durations/index.std.js';
import { version } from '../util/packageJson.node.js';
import { isNotUpdatable } from '../util/version.std.js';

const unixTimestamp = parseInt(
  process.env.SOURCE_DATE_EPOCH ||
    execSync('git show -s --format=%ct').toString('utf8'),
  10
);
const buildCreation = unixTimestamp * 1000;

// NB: Build expirations are also determined via users' auto-update settings; see
// getExpirationTimestamp
const validDuration = isNotUpdatable(version) ? DAY * 30 : DAY * 90;
const buildExpiration = buildCreation + validDuration;

const localProductionPath = join(
  __dirname,
  '../../config/local-production.json'
);

const localProductionConfig = {
  buildCreation,
  buildExpiration,
  ...(isNotUpdatable(version) ? { updatesEnabled: false } : {}),
};

writeFileSync(
  localProductionPath,
  `${JSON.stringify(localProductionConfig)}\n`
);

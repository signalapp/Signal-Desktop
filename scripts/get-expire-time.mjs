// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { DAY } from './utils/durations.mjs';
import { parseVersion } from './utils/parseVersion.mjs';
import packageJson from '../package.json' with { type: 'json' };

const unixTimestamp = parseInt(
  process.env.SOURCE_DATE_EPOCH ||
    execSync('git show -s --format=%ct').toString('utf8'),
  10
);
const buildCreation = unixTimestamp * 1000;

const isNotUpdatable = !parseVersion(packageJson.version).isUpdatable;

// NB: Build expirations are also determined via users' auto-update settings; see
// getExpirationTimestamp
const validDuration = isNotUpdatable ? DAY * 30 : DAY * 90;
const buildExpiration = buildCreation + validDuration;

const localProductionPath = join(
  import.meta.dirname,
  '../config/local-production.json'
);

const localProductionConfig = {
  buildCreation,
  buildExpiration,
  ...(isNotUpdatable ? { updatesEnabled: false } : {}),
};

writeFileSync(
  localProductionPath,
  `${JSON.stringify(localProductionConfig)}\n`
);

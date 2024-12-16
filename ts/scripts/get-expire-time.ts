// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

import { DAY } from '../util/durations';
import { version } from '../../package.json';
import { isAdhoc } from '../util/version';

const unixTimestamp = parseInt(
  process.env.SOURCE_DATE_EPOCH ||
    execSync('git show -s --format=%ct').toString('utf8'),
  10
);
const buildCreation = unixTimestamp * 1000;

const buildExpiration = buildCreation + DAY * 90;

const localProductionPath = join(
  __dirname,
  '../../config/local-production.json'
);

const localProductionConfig = {
  buildCreation,
  buildExpiration,
  ...(isAdhoc(version) ? { updatesEnabled: false } : {}),
};

writeFileSync(
  localProductionPath,
  `${JSON.stringify(localProductionConfig)}\n`
);

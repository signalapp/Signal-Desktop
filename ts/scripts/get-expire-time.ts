// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

import { DAY } from '../util/durations';

const unixTimestamp = parseInt(
  execSync('git show -s --format=%ct').toString('utf8'),
  10
);
const buildCreation = unixTimestamp * 1000;

const buildExpiration = buildCreation + DAY * 90;

const localProductionPath = join(
  __dirname,
  '../../config/local-production.json'
);
const localProductionConfig = { buildCreation, buildExpiration };
writeFileSync(
  localProductionPath,
  `${JSON.stringify(localProductionConfig)}\n`
);

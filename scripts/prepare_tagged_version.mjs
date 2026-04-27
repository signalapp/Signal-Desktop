// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import _ from 'lodash';
import { generateTaggedVersion } from './utils/generateTaggedVersion.mjs';
import packageJson from '../package.json' with { type: 'json' };

const release = process.argv[2];
if (release !== 'alpha' && release !== 'axolotl' && release !== 'adhoc') {
  console.error(`Invalid release line: ${release}`);
  process.exit(1);
}

const shortSha = execSync('git rev-parse --short=9 HEAD')
  .toString('utf8')
  .replace(/[\n\r]/g, '');

const currentVersion = packageJson.version;
const newVersion = generateTaggedVersion({ release, currentVersion, shortSha });

console.log(
  `prepare_tagged_version: updating package.json.\n  Previous: ${currentVersion}\n  New:      ${newVersion}`
);

// -------

_.set(packageJson, 'version', newVersion);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

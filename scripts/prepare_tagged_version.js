// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('node:fs');
const { execSync } = require('node:child_process');

const _ = require('lodash');
const {
  default: packageJson,
  version: currentVersion,
} = require('./packageJson.js');

const release = process.argv[2];
if (release !== 'alpha' && release !== 'axolotl' && release !== 'adhoc') {
  console.error(`Invalid release line: ${release}`);
  process.exit(1);
}

const { generateTaggedVersion } = require('../ts/util/version.std.js');

const shortSha = execSync('git rev-parse --short=9 HEAD')
  .toString('utf8')
  .replace(/[\n\r]/g, '');

const newVersion = generateTaggedVersion({ release, currentVersion, shortSha });

console.log(
  `prepare_tagged_version: updating package.json.\n  Previous: ${currentVersion}\n  New:      ${newVersion}`
);

// -------

_.set(packageJson, 'version', newVersion);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

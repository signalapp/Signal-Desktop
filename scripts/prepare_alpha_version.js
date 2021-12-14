// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('fs');
const { execSync } = require('child_process');

const _ = require('lodash');

const { generateAlphaVersion } = require('../ts/util/version');

const packageJson = require('../package.json');

const { version: currentVersion } = packageJson;

const shortSha = execSync('git rev-parse --short HEAD')
  .toString('utf8')
  .replace(/[\n\r]/g, '');

const alphaVersion = generateAlphaVersion({ currentVersion, shortSha });

console.log(
  `prepare_alpha_version: updating package.json.\n  Previous: ${currentVersion}\n  New:      ${alphaVersion}`
);

// -------

_.set(packageJson, 'version', alphaVersion);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

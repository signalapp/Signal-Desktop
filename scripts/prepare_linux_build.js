// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('node:fs');
const _ = require('lodash');

const TARGETS = new Set(['appimage', 'deb']);

const targets = (process.argv[2] || '').split(',');
if (
  targets.length === 0 ||
  !targets.every(target => TARGETS.has(target.toLowerCase()))
) {
  console.error(
    `Invalid linux targets ${targets}. Valid options: ${[...TARGETS]}`
  );
  process.exit(1);
}

const { default: packageJson } = require('./packageJson.js');

console.log('prepare_linux_build: updating package.json');

// ------

_.set(packageJson, 'build.linux.target', targets);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

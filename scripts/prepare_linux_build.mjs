// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs from 'node:fs';
import _ from 'lodash';
import packageJson from '../package.json' with { type: 'json' };

const TARGETS = new Set(['appimage', 'deb']);

const targets = (process.argv[2] || '').split(',');
if (
  targets.length === 0 ||
  !targets.every(target => TARGETS.has(target.toLowerCase()))
) {
  console.error(
    `Invalid linux targets ${targets.join(', ')}. Valid options: ${[...TARGETS].join(', ')}`
  );
  process.exit(1);
}

console.log('prepare_linux_build: updating package.json');

// ------

_.set(packageJson, 'build.linux.target', targets);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

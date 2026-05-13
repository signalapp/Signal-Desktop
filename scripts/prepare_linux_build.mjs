// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs from 'node:fs';
import _ from 'lodash';
import packageJson from '../package.json' with { type: 'json' };

const TARGETS = new Set(['appimage', 'deb']);
const ARCHITECTURES = new Set(['arm64', 'x64']);

const targets = (process.argv[2] || 'deb').split(',');
if (
  targets.length === 0 ||
  !targets.every(target => TARGETS.has(target.toLowerCase()))
) {
  console.error(
    `Invalid linux targets ${targets.join(', ')}. Valid options: ${[...TARGETS].join(', ')}`
  );
  process.exit(1);
}

const archs = (process.argv[3] || 'x64').split(',');
if (
  archs.length === 0 ||
  !archs.every(arch => ARCHITECTURES.has(arch.toLowerCase()))
) {
  console.error(
    `Invalid linux architectures ${archs.join(', ')}. Valid options: ${[...ARCHITECTURES].join(', ')}`
  );
  process.exit(1);
}

console.log('prepare_linux_build: updating package.json');

// ------

const targetsWithArch = _.map(targets, target => ({ target, arch: archs }));

_.set(packageJson, 'build.linux.target', targetsWithArch);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

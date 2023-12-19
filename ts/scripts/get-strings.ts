// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { execSync } from 'child_process';
import fsExtra from 'fs-extra';
import path from 'path';
import fastGlob from 'fast-glob';

const { SMARTLING_USER, SMARTLING_SECRET } = process.env;

if (!SMARTLING_USER) {
  console.error('Need to set SMARTLING_USER environment variable!');
  process.exit(1);
}
if (!SMARTLING_SECRET) {
  console.error('Need to set SMARTLING_SECRET environment variable!');
  process.exit(1);
}

console.log('Cleaning _locales directory...');
const dirEntries = fastGlob.sync(['_locales/*', '!_locales/en'], {
  onlyDirectories: true,
  absolute: true,
});

for (const dirEntry of dirEntries) {
  fsExtra.rmdirSync(dirEntry, { recursive: true });
}

console.log('Fetching latest strings!');
console.log();
execSync(
  'smartling-cli' +
    ` --user "${SMARTLING_USER}"` +
    ` --secret "${SMARTLING_SECRET}"` +
    ' --config .smartling.yml' +
    ' --verbose' +
    ' --format "_locales/{{.Locale}}/messages.json"' +
    ' files pull',
  {
    stdio: [null, process.stdout, process.stderr],
  }
);

function rename(from: string, to: string) {
  console.log(`Renaming "${from}" to "${to}"`);
  fsExtra.moveSync(path.join('_locales', from), path.join('_locales', to), {
    overwrite: true,
  });
}

// Smartling uses "zh-YU" for Cantonese (or Yue Chinese).
// This is wrong.
// The language tag for Yue Chinese is "yue"
// "zh-YU" actually implies "Chinese as spoken in Yugoslavia (canonicalized to Serbia)"
rename('zh-YU', 'yue');

// For most of the Chinese-speaking world, where we don't have a region specific
// locale available (e.g. zh-HK), zh-TW is a suitable choice for "Traditional Chinese".
//
// However, Intl.LocaleMatcher won't match "zh-Hant-XX" to "zh-TW",
// we need to rename it to "zh-Hant" explicitly to make it work.
rename('zh-TW', 'zh-Hant');

// "YR" is not a valid region subtag. Smartling made it up.
rename('sr-YR', 'sr');

console.log('Formatting newly-downloaded strings!');
console.log();
execSync('yarn format', {
  stdio: [null, process.stdout, process.stderr],
});

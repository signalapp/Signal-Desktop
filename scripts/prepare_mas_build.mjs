// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs from 'node:fs';
import _ from 'lodash';
import moment from 'moment';

import { parseVersion } from './utils/parseVersion.mjs';
import { getBuildCreationTimestamp } from './utils/getBuildCreationTimestamp.mjs';
import packageJson from '../package.json' with { type: 'json' };

const version = parseVersion(packageJson.version);
if (version.channel !== 'alpha' && version.channel !== 'prod') {
  console.error('Only alpha or prod versions can be published as MAS builds');
  process.exit(1);
}

console.log('prepare_mas_build: updating package.json');

const buildCreationTimestamp = getBuildCreationTimestamp();

// -------

const NAME_PATH = 'name';
const VERSION_PATH = 'version';
const PRODUCTION_NAME = 'signal-desktop';

const PRODUCT_NAME_PATH = 'productName';
const PRODUCTION_PRODUCT_NAME = 'Signal';

const APP_ID_PATH = 'build.appId';
const PRODUCTION_APP_ID = 'org.whispersystems.signal-desktop';

const BUNDLE_SHORT_VERSION_PATH = 'build.mac.bundleShortVersion';
const BUNDLE_VERSION_PATH = 'build.mac.bundleVersion';
const NON_MAS_BUNDLE_SHORT_VERSION = undefined;
const NON_MAS_BUNDLE_VERSION = '1';
const MAS_BUNDLE_VERSION = moment(buildCreationTimestamp).format(
  'YYYY.MM.DDHHmm'
);

const FILE_EXCLUSION_LIST = ['!fonts/emoji.woff2'];

// -------

/**
 * @param {object} object
 * @param {string} objectPath
 * @param {string | undefined} expected
 */
function checkValue(object, objectPath, expected) {
  const actual = _.get(object, objectPath);
  if (actual !== expected) {
    throw new Error(`${objectPath} was ${actual}; expected ${expected}`);
  }
}

// ------

checkValue(packageJson, NAME_PATH, PRODUCTION_NAME);
checkValue(packageJson, PRODUCT_NAME_PATH, PRODUCTION_PRODUCT_NAME);
checkValue(packageJson, APP_ID_PATH, PRODUCTION_APP_ID);
checkValue(
  packageJson,
  BUNDLE_SHORT_VERSION_PATH,
  NON_MAS_BUNDLE_SHORT_VERSION
);
checkValue(packageJson, BUNDLE_VERSION_PATH, NON_MAS_BUNDLE_VERSION);
for (const file of FILE_EXCLUSION_LIST) {
  if (packageJson.build.files.includes(file)) {
    throw new Error(`Expected ${file} to be absent from 'files'`);
  }
}

// -------

if (version.channel === 'alpha') {
  const { major, minor, patch } = version;
  const tag = moment(buildCreationTimestamp).format('YYYYMMDDHHmm');
  _.set(packageJson, VERSION_PATH, `${major}.${minor}.${patch}-alpha.${tag}`);
}
_.set(
  packageJson,
  BUNDLE_SHORT_VERSION_PATH,
  `${version.major}.${version.minor}.${version.patch}`
);
_.set(packageJson, BUNDLE_VERSION_PATH, MAS_BUNDLE_VERSION);
for (const file of FILE_EXCLUSION_LIST) {
  packageJson.build.files.push(file);
}

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

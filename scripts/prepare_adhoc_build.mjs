// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import fs from 'node:fs';
import _ from 'lodash';
import { execSync } from 'node:child_process';
import { parseVersion } from './utils/parseVersion.mjs';
import packageJson from '../package.json' with { type: 'json' };

// You might be wondering why this file is necessary. It comes down to our desire to allow
//   side-by-side installation of production and adhoc builds. Electron-Builder uses
//   top-level data from package.json for many things, like the executable name, the
//   debian package name, the install directory under /opt on linux, etc. We tried
//   adding the ${channel} macro to these values, but Electron-Builder didn't like that.

if (parseVersion(packageJson.version).channel !== 'adhoc') {
  console.error(`Version '${packageJson.version}' is not an adhoc version!`);
  process.exit(1);
}

const shortSha = execSync('git rev-parse --short HEAD')
  .toString('utf8')
  .replace(/[\n\r]/g, '');

const dateTimeParts = new Intl.DateTimeFormat('en', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  month: '2-digit',
  timeZone: 'GMT',
  year: 'numeric',
}).formatToParts(new Date());
const dateTimeMap = new Map();
dateTimeParts.forEach(({ type, value }) => {
  dateTimeMap.set(type, value);
});
const formattedDate = `${dateTimeMap.get('year')}${dateTimeMap.get(
  'month'
)}${dateTimeMap.get('day')}`;

console.log(
  `prepare_adhoc_build(adhoc-${formattedDate}-${shortSha}): updating package.json`
);

// -------

const NAME_PATH = 'name';
const PRODUCTION_NAME = 'signal-desktop';
const ADHOC_NAME = `signal-desktop-adhoc-${formattedDate}-${shortSha}`;

const PRODUCT_NAME_PATH = 'productName';
const PRODUCTION_PRODUCT_NAME = 'Signal';
const ADHOC_PRODUCT_NAME = `Signal Adhoc ${formattedDate}.${shortSha}`;

const APP_ID_PATH = 'build.appId';
const PRODUCTION_APP_ID = 'org.whispersystems.signal-desktop';
const ADHOC_APP_ID = `org.whispersystems.signal-desktop-adhoc-${formattedDate}-${shortSha}`;

const STARTUP_WM_CLASS_PATH = 'build.linux.desktop.entry.StartupWMClass';
const PRODUCTION_WM_CLASS = 'signal';
const ADHOC_WM_CLASS = `signal adhoc ${formattedDate} ${shortSha}`;

const DESKTOP_NAME_PATH = 'desktopName';

// Note: we're avoiding dashes in our .desktop name due to xdg-settings behavior
//   https://github.com/signalapp/Signal-Desktop/issues/3602
const PRODUCTION_DESKTOP_NAME = 'signal.desktop';
const ADHOC_DESKTOP_NAME = `signal adhoc ${formattedDate} ${shortSha}.desktop`;

const EXECUTABLE_NAME_PATH = 'build.linux.executableName';
const PRODUCTION_EXECUTABLE_NAME = 'signal-desktop';
const ADHOC_EXECUTABLE_NAME = `signal-desktop-adhoc-${formattedDate}-${shortSha}`;

// -------

/**
 * @param {object} object
 * @param {string} objectPath
 * @param {string} expected
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
checkValue(packageJson, STARTUP_WM_CLASS_PATH, PRODUCTION_WM_CLASS);
checkValue(packageJson, DESKTOP_NAME_PATH, PRODUCTION_DESKTOP_NAME);
checkValue(packageJson, EXECUTABLE_NAME_PATH, PRODUCTION_EXECUTABLE_NAME);

// -------

_.set(packageJson, NAME_PATH, ADHOC_NAME);
_.set(packageJson, PRODUCT_NAME_PATH, ADHOC_PRODUCT_NAME);
_.set(packageJson, APP_ID_PATH, ADHOC_APP_ID);
_.set(packageJson, STARTUP_WM_CLASS_PATH, ADHOC_WM_CLASS);
_.set(packageJson, DESKTOP_NAME_PATH, ADHOC_DESKTOP_NAME);
_.set(packageJson, EXECUTABLE_NAME_PATH, ADHOC_EXECUTABLE_NAME);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

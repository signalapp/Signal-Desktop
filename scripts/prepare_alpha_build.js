// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('fs');
const _ = require('lodash');

const packageJson = require('../package.json');
const { isAlpha } = require('../ts/util/version');

const { version } = packageJson;

// You might be wondering why this file is necessary. It comes down to our desire to allow
//   side-by-side installation of production and alpha builds. Electron-Builder uses
//   top-level data from package.json for many things, like the executable name, the
//   debian package name, the install directory under /opt on linux, etc. We tried
//   adding the ${channel} macro to these values, but Electron-Builder didn't like that.

if (!isAlpha(version)) {
  console.error(`Version '${version}' is not an alpha version!`);
  process.exit(1);
}

console.log('prepare_alpha_build: updating package.json');

// -------

const NAME_PATH = 'name';
const PRODUCTION_NAME = 'signal-desktop';
const ALPHA_NAME = 'signal-desktop-alpha';

const PRODUCT_NAME_PATH = 'productName';
const PRODUCTION_PRODUCT_NAME = 'Signal';
const ALPHA_PRODUCT_NAME = 'Signal Alpha';

const APP_ID_PATH = 'build.appId';
const PRODUCTION_APP_ID = 'org.whispersystems.signal-desktop';
const ALPHA_APP_ID = 'org.whispersystems.signal-desktop-alpha';

const DESKTOP_NAME_PATH = 'desktopName';

// Note: we're avoiding dashes in our .desktop name due to xdg-settings behavior
//   https://github.com/signalapp/Signal-Desktop/issues/3602
const PRODUCTION_DESKTOP_NAME = 'signal.desktop';
const ALPHA_DESKTOP_NAME = 'signalalpha.desktop';

// -------

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
checkValue(packageJson, DESKTOP_NAME_PATH, PRODUCTION_DESKTOP_NAME);

// -------

_.set(packageJson, NAME_PATH, ALPHA_NAME);
_.set(packageJson, PRODUCT_NAME_PATH, ALPHA_PRODUCT_NAME);
_.set(packageJson, APP_ID_PATH, ALPHA_APP_ID);
_.set(packageJson, DESKTOP_NAME_PATH, ALPHA_DESKTOP_NAME);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

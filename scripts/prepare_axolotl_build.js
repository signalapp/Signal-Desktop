// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const fs = require('fs');
const _ = require('lodash');

const packageJson = require('../package.json');
const { isAxolotl } = require('../ts/util/version');

const { version } = packageJson;

// You might be wondering why this file is necessary. It comes down to our desire to allow
//   side-by-side installation of production and alpha builds. Electron-Builder uses
//   top-level data from package.json for many things, like the executable name, the
//   debian package name, the install directory under /opt on linux, etc. We tried
//   adding the ${channel} macro to these values, but Electron-Builder didn't like that.

if (!isAxolotl(version)) {
  console.error(`Version '${version}' is not an backup version!`);
  process.exit(1);
}

console.log('prepare_backup_build: updating package.json');

// -------

const NAME_PATH = 'name';
const PRODUCTION_NAME = 'signal-desktop';
const AXOLOTL_NAME = 'signal-desktop-axolotl';

const PRODUCT_NAME_PATH = 'productName';
const PRODUCTION_PRODUCT_NAME = 'Signal';
const AXOLOTL_PRODUCT_NAME = 'Signal Axolotl';

const APP_ID_PATH = 'build.appId';
const PRODUCTION_APP_ID = 'org.whispersystems.signal-desktop';
const AXOLOTL_APP_ID = 'org.whispersystems.signal-desktop-axolotl';

const DESKTOP_NAME_PATH = 'desktopName';

// Note: we're avoiding dashes in our .desktop name due to xdg-settings behavior
//   https://github.com/signalapp/Signal-Desktop/issues/3602
const PRODUCTION_DESKTOP_NAME = 'signal.desktop';
const AXOLOTL_DESKTOP_NAME = 'signalaxolotl.desktop';

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

_.set(packageJson, NAME_PATH, AXOLOTL_NAME);
_.set(packageJson, PRODUCT_NAME_PATH, AXOLOTL_PRODUCT_NAME);
_.set(packageJson, APP_ID_PATH, AXOLOTL_APP_ID);
_.set(packageJson, DESKTOP_NAME_PATH, AXOLOTL_DESKTOP_NAME);

// -------

fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

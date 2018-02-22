const fs = require('fs');
const _ = require('lodash');

const packageJson = require('./package.json');
const defaultConfig = require('./config/default.json');

function checkValue(object, objectPath, expected) {
  const actual = _.get(object, objectPath);
  if (actual !== expected) {
    throw new Error(`${objectPath} was ${actual}; expected ${expected}`);
  }
}

// You might be wondering why this file is necessary. We have some very specific
//   requirements around our import-flavor builds. They need to look exactly the same as
//   normal builds, but they must immediately open into import mode. So they need a
//   slight config tweak, and then a change to the .app/.exe name (note: we do NOT want to
//   change where data is stored or anything, since that would make these builds
//   incompatible with the mainline builds) So we just change the artifact name.
//
// Another key thing to know about these builds is that we should not upload the
//   latest.yml (windows) and latest-mac.yml (mac) that go along with the executables.
//   This would interrupt the normal install flow for users installing from
//   signal.org/download. So any release script will need to upload these files manually
//   instead of relying on electron-builder, which will upload everything.

// -------

console.log('prepare_import_build: updating config/default.json');

const IMPORT_PATH = 'import';
const IMPORT_START_VALUE = false;
const IMPORT_END_VALUE = true;

checkValue(defaultConfig, IMPORT_PATH, IMPORT_START_VALUE);

_.set(defaultConfig, IMPORT_PATH, IMPORT_END_VALUE);

// -------

console.log('prepare_import_build: updating package.json');

const MAC_ASSET_PATH = 'build.mac.artifactName';
const MAC_ASSET_START_VALUE = '${name}-mac-${version}.${ext}';
const MAC_ASSET_END_VALUE = '${name}-mac-${version}-import.${ext}';

const WIN_ASSET_PATH = 'build.win.artifactName';
const WIN_ASSET_START_VALUE = '${name}-win-${version}.${ext}';
const WIN_ASSET_END_VALUE = '${name}-win-${version}-import.${ext}';

checkValue(packageJson, MAC_ASSET_PATH, MAC_ASSET_START_VALUE);
checkValue(packageJson, WIN_ASSET_PATH, WIN_ASSET_START_VALUE);

_.set(packageJson, MAC_ASSET_PATH, MAC_ASSET_END_VALUE);
_.set(packageJson, WIN_ASSET_PATH, WIN_ASSET_END_VALUE);

// ---

fs.writeFileSync('./config/default.json', JSON.stringify(defaultConfig, null, '  '));
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

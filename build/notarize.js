const { notarize } = require('electron-notarize');

/*
 Pre-requisites: https://github.com/electron/electron-notarize#prerequisites
    1. Generate an app specific password
    2. Export SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID environment variables
*/

/*
  Notarizing: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
*/

const log = msg => console.log(`\n${msg}`);
const isEmpty = v => !v || v.length === 0;

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }
  log('Notarizing mac application');

  const appName = context.packager.appInfo.productFilename;
  const {
    SIGNING_APPLE_ID,
    SIGNING_APP_PASSWORD,
    SIGNING_TEAM_ID,
  } = process.env;

  if (isEmpty(SIGNING_APPLE_ID) || isEmpty(SIGNING_APP_PASSWORD)) {
    log(
      'SIGNING_APPLE_ID or SIGNING_APP_PASSWORD not set.\nTerminating noratization.'
    );
    return;
  }

  const options = {
    appBundleId: 'org.getsession.desktop',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: SIGNING_APPLE_ID,
    appleIdPassword: SIGNING_APP_PASSWORD,
  };
  if (!isEmpty(SIGNING_TEAM_ID)) options.ascProvider = SIGNING_TEAM_ID;
  return notarize(options);
};

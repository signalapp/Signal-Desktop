const { notarize } = require('electron-notarize');

/*
 Pre-requisites: https://github.com/electron/electron-notarize#prerequisites
    1. Generate an app specific password
    2. Export SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID environment variables
*/

/*
  Notarizing: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
*/

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return notarize({
    appBundleId: 'com.loki-project.messenger-desktop',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.SIGNING_APPLE_ID,
    appleIdPassword: process.env.SIGNING_APP_PASSWORD,
    ascProvider: process.env.SIGNING_TEAM_ID,
  });
};

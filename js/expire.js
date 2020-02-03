/* global LokiAppDotNetServerAPI, LokiFileServerAPI, semver, log */
// eslint-disable-next-line func-names
(function() {
  'use strict';

  // hold last result
  let expiredVersion = null;

  window.tokenlessFileServerAdnAPI = new LokiAppDotNetServerAPI(
    '', // no pubkey needed
    window.getDefaultFileServer()
  );
  window.tokenlessFileServerAdnAPI.pubKey = window.Signal.Crypto.base64ToArrayBuffer(
    LokiFileServerAPI.secureRpcPubKey
  );

  const checkForUpgrades = async () => {
    const response = await window.tokenlessFileServerAdnAPI.serverRequest(
      'loki/v1/version/client/desktop'
    );
    if (response && response.response) {
      const latestVer = semver.clean(response.response.data[0][0]);
      if (semver.valid(latestVer)) {
        const ourVersion = window.getVersion();
        if (latestVer === ourVersion) {
          log.info('You have the latest version', latestVer);
          // change the following to true ot test/see expiration banner
          expiredVersion = false;
        } else {
          // expire if latest is newer than current
          expiredVersion = semver.gt(latestVer, ourVersion);
          if (expiredVersion) {
            log.info('There is a newer version available', latestVer);
          }
        }
      }
    } else {
      // give it a minute
      log.warn('Could not check to see if newer version is available');
      setTimeout(async () => {
        await checkForUpgrades();
      }, 60 * 1000); // wait a minute
    }
    // no message logged means serverRequest never returned...
  };
  checkForUpgrades();

  window.extension = window.extension || {};

  window.extension.expired = cb => {
    if (expiredVersion === null) {
      // just give it another second
      log.info('Delaying expire banner determination for 1s');
      setTimeout(() => {
        window.extension.expired(cb);
      }, 1000);
      return;
    }
    // yes we know
    cb(expiredVersion);
  };
})();

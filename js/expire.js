/* global LokiAppDotNetServerAPI, semver, log */
// eslint-disable-next-line func-names
(function() {
  'use strict';

  // hold last result
  let expiredVersion = null;

  window.tokenlessFileServerAdnAPI = new LokiAppDotNetServerAPI(
    '', // no pubkey needed
    window.getDefaultFileServer()
  );
  // use the anonymous access token
  window.tokenlessFileServerAdnAPI.token = 'loki';
  // configure for file server comms
  window.tokenlessFileServerAdnAPI.getPubKeyForUrl();

  let nextWaitSeconds = 5;
  const checkForUpgrades = async () => {
    try {
      window.libsession.Utils.UserUtils.getOurPubKeyStrFromCache();
    } catch (e) {
      // give it a minute
      log.warn('Could not check to see if newer version is available cause our pubkey is not set');
      nextWaitSeconds = 60;
      setTimeout(async () => {
        await checkForUpgrades();
      }, nextWaitSeconds * 1000); // wait a minute
      return;
    }
    const result = await window.tokenlessFileServerAdnAPI.serverRequest(
      'loki/v1/version/client/desktop'
    );

    if (
      result &&
      result.response &&
      result.response.data &&
      result.response.data.length &&
      result.response.data[0].length
    ) {
      const latestVer = semver.clean(result.response.data[0][0]);
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
      log.warn('Could not check to see if newer version is available', result);
      nextWaitSeconds = 60;
      setTimeout(async () => {
        await checkForUpgrades();
      }, nextWaitSeconds * 1000); // wait a minute
    }
    // no message logged means serverRequest never returned...
  };

  // don't wait for this to finish
  // FIXME audric
  // checkForUpgrades();

  window.extension = window.extension || {};

  // eslint-disable-next-line no-unused-vars
  const resolveWhenReady = (res, rej) => {
    if (expiredVersion !== null) {
      return res(expiredVersion);
    }
    function waitForVersion() {
      if (expiredVersion !== null) {
        return res(expiredVersion);
      }
      log.info(`Delaying sending checks for ${nextWaitSeconds}s, no version yet`);
      setTimeout(waitForVersion, nextWaitSeconds * 1000);
      return true;
    }
    waitForVersion();
    return true;
  };

  // just get current status
  window.extension.expiredStatus = () => expiredVersion;
  // actually wait until we know for sure
  window.extension.expiredPromise = () => new Promise(resolveWhenReady);
  window.extension.expired = cb => {
    if (expiredVersion === null) {
      // just give it another second
      log.info(`Delaying expire banner determination for ${nextWaitSeconds}s`);
      setTimeout(() => {
        window.extension.expired(cb);
      }, nextWaitSeconds * 1000);
      return;
    }
    // yes we know
    cb(expiredVersion);
  };

  const getServerTime = async () => {
    let timestamp = NaN;

    try {
      const res = await window.tokenlessFileServerAdnAPI.serverRequest('loki/v1/time');
      if (res.ok) {
        timestamp = res.response;
      }
    } catch (e) {
      return timestamp;
    }

    return Number(timestamp);
  };

  const getTimeDifferential = async () => {
    // Get time differential between server and client in seconds
    const serverTime = await getServerTime();
    const clientTime = Math.ceil(Date.now() / 1000);

    if (Number.isNaN(serverTime)) {
      log.error('expire:::getTimeDifferential - serverTime is not valid');
      return 0;
    }
    return serverTime - clientTime;
  };

  // require for PoW to work
  window.setClockParams = async () => {
    // Set server-client time difference
    const maxTimeDifferential = 30 + 15; // + 15 for onion requests
    const timeDifferential = await getTimeDifferential();
    log.info('expire:::setClockParams - Clock difference', timeDifferential);

    window.clientClockSynced = Math.abs(timeDifferential) < maxTimeDifferential;
    return window.clientClockSynced;
  };
})();

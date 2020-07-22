/* global Whisper, storage, getAccountManager */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const ROTATION_INTERVAL = 48 * 60 * 60 * 1000;
  let timeout;

  function scheduleNextRotation() {
    const now = Date.now();
    const nextTime = now + ROTATION_INTERVAL;
    storage.put('nextSignedKeyRotationTime', nextTime);
  }

  function scheduleRotationForNow() {
    const now = Date.now();
    storage.put('nextSignedKeyRotationTime', now);
  }

  async function run() {
    window.log.info('Rotating signed prekey...');
    try {
      await getAccountManager().rotateSignedPreKey();
      scheduleNextRotation();
      setTimeoutForNextRun();
    } catch (error) {
      window.log.error(
        'rotateSignedPrekey() failed. Trying again in five minutes'
      );
      setTimeout(setTimeoutForNextRun, 5 * 60 * 1000);
    }
  }

  function runWhenOnline() {
    if (navigator.onLine) {
      run();
    } else {
      window.log.info(
        'We are offline; keys will be rotated when we are next online'
      );
      const listener = () => {
        window.removeEventListener('online', listener);
        setTimeoutForNextRun();
      };
      window.addEventListener('online', listener);
    }
  }

  function setTimeoutForNextRun() {
    const now = Date.now();
    const time = storage.get('nextSignedKeyRotationTime', now);

    window.log.info(
      'Next signed key rotation scheduled for',
      new Date(time).toISOString()
    );

    let waitTime = time - now;
    if (waitTime < 0) {
      waitTime = 0;
    }

    clearTimeout(timeout);
    timeout = setTimeout(runWhenOnline, waitTime);
  }

  let initComplete;
  Whisper.RotateSignedPreKeyListener = {
    init(events, newVersion) {
      if (initComplete) {
        window.log.info('Rotate signed prekey listener: Already initialized');
        return;
      }
      initComplete = true;

      if (newVersion) {
        scheduleRotationForNow();
        setTimeoutForNextRun();
      } else {
        setTimeoutForNextRun();
      }

      events.on('timetravel', () => {
        if (window.Signal.Util.Registration.isDone()) {
          setTimeoutForNextRun();
        }
      });
    },
  };
})();

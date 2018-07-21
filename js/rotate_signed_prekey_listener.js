/* global Whisper, storage, getAccountManager */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const ROTATION_INTERVAL = 48 * 60 * 60 * 1000;
  let timeout;
  let scheduledTime;

  function scheduleNextRotation() {
    const now = Date.now();
    const nextTime = now + ROTATION_INTERVAL;
    storage.put('nextSignedKeyRotationTime', nextTime);
  }

  function run() {
    window.log.info('Rotating signed prekey...');
    getAccountManager()
      .rotateSignedPreKey()
      .catch(() => {
        window.log.error(
          'rotateSignedPrekey() failed. Trying again in five seconds'
        );
        setTimeout(runWhenOnline, 5000);
      });
    scheduleNextRotation();
    setTimeoutForNextRun();
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
        run();
      };
      window.addEventListener('online', listener);
    }
  }

  function setTimeoutForNextRun() {
    const now = Date.now();
    const time = storage.get('nextSignedKeyRotationTime', now);

    if (scheduledTime !== time || !timeout) {
      window.log.info(
        'Next signed key rotation scheduled for',
        new Date(time).toISOString()
      );
    }

    scheduledTime = time;
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
        window.log.warn('Rotate signed prekey listener: Already initialized');
        return;
      }
      initComplete = true;

      if (newVersion) {
        runWhenOnline();
      } else {
        setTimeoutForNextRun();
      }

      events.on('timetravel', () => {
        if (Whisper.Registration.isDone()) {
          setTimeoutForNextRun();
        }
      });
    },
  };
})();

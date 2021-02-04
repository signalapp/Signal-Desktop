// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  let lastTime;
  const interval = 1000;
  let events;
  function checkTime() {
    const currentTime = Date.now();
    if (currentTime > lastTime + interval * 2) {
      events.trigger('timetravel');
    }
    lastTime = currentTime;
  }

  Whisper.WallClockListener = {
    init(_events) {
      events = _events;
      lastTime = Date.now();
      setInterval(checkTime, interval);
    },
  };
})();

/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var lastTime;
    var interval = 5000;
    var events;
    function checkTime() {
      var currentTime = Date.now();
      if (currentTime > (lastTime + interval * 2)) {
          events.trigger('timetravel');
      }
      lastTime = currentTime;
    }

    Whisper.WallClockListener = {
      init: function(_events) {
          events = _events;
          lastTime = Date.now();
          setInterval(checkTime, interval);
      }
    };
}());

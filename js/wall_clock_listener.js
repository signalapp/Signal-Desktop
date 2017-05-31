/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var lastTime;
    var interval = 1000;
    var events;
    function checkTime() {
      var currentTime = Date.now();
      if (currentTime > (lastTime + interval * 2)) {
          console.log('time travel detected!');
          events.trigger('timetravel');
      }
      lastTime = currentTime;
    }

    Whisper.WallClockListener = {
      init: function(_events) {
          events = _events;
          lastTime = Date.now();
          setInterval(checkTime, 1000);
      }
    };
}());

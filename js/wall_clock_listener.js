/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    var lastTime;
    var interval = 1000;
    function checkTime() {
      var currentTime = Date.now();
      if (currentTime > (lastTime + interval * 2)) {
          console.log('time travel detected!');
          window.events.trigger('timetravel');
      }
      lastTime = currentTime;
    }

    Whisper.WallClockListener = {
      init: function() {
          lastTime = Date.now();
          setInterval(checkTime, 1000);
      }
    };
}());

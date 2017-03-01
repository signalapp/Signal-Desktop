/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';

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

    window.WallClockListener = {
      init: function() {
          lastTime = Date.now();
          setInterval(checkTime, 1000);
      }
    };
}());

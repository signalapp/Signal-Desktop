;(function() {
    'use strict';
    var BUILD_EXPIRATION = 0;

    window.extension = window.extension || {};

    extension.expired = function() {
      return (BUILD_EXPIRATION && Date.now() > BUILD_EXPIRATION);
    };
})();

;(function() {
    'use strict';
    var BUILD_EXPIRATION = 0;
    try {
        BUILD_EXPIRATION = parseInt(window.config.buildExpiration);
        if (BUILD_EXPIRATION) {
            console.log("Build expires: ", new Date(BUILD_EXPIRATION).toISOString());
        }
    } catch (e) {}

    window.extension = window.extension || {};

    extension.expired = function() {
      return (BUILD_EXPIRATION && Date.now() > BUILD_EXPIRATION);
    };
})();

// eslint-disable-next-line func-names
(function() {
  'use strict';

  let BUILD_EXPIRATION = 0;
  try {
    BUILD_EXPIRATION = parseInt(window.getExpiration(), 10);
    if (BUILD_EXPIRATION) {
      console.log('Build expires: ', new Date(BUILD_EXPIRATION).toISOString());
    }
  } catch (e) {
    // nothing
  }

  window.extension = window.extension || {};

  window.extension.expired = () =>
    BUILD_EXPIRATION && Date.now() > BUILD_EXPIRATION;
})();

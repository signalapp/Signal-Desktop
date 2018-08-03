/* global extension: false */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  // Browser specific functions for Chrom*
  window.extension = window.extension || {};

  extension.windows = {
    onClosed(callback) {
      window.addEventListener('beforeunload', callback);
    },
  };
})();

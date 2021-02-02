/* global window, textsecure, SignalProtocolStore */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};
  textsecure.storage.protocol = new SignalProtocolStore();
})();

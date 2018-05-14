(function() {
  'use strict';
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  textsecure.storage.protocol = new SignalProtocolStore();

  textsecure.ProvisioningCipher = libsignal.ProvisioningCipher;
  textsecure.startWorker = libsignal.worker.startWorker;
  textsecure.stopWorker = libsignal.worker.stopWorker;
})();

// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window, textsecure, SignalProtocolStore, libsignal */

// eslint-disable-next-line func-names
(function () {
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  textsecure.storage.protocol = new SignalProtocolStore();

  textsecure.ProvisioningCipher = libsignal.ProvisioningCipher;
  textsecure.startWorker = libsignal.worker.startWorker;
  textsecure.stopWorker = libsignal.worker.stopWorker;
})();

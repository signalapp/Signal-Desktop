// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window, SignalProtocolStore */

// eslint-disable-next-line func-names
(function () {
  window.textsecure.storage.protocol = new SignalProtocolStore();
})();

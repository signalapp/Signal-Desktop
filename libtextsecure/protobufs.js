// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window, dcodeIO, textsecure */

// eslint-disable-next-line func-names
(function() {
  const FILES_TO_LOAD = [
    'SignalService.proto',
    'SignalStorage.proto',
    'SubProtocol.proto',
    'DeviceMessages.proto',
    'Stickers.proto',

    // Just for encrypting device names
    'DeviceName.proto',

    // Metadata-specific protos
    'UnidentifiedDelivery.proto',

    // Groups
    'Groups.proto',
  ];

  let remainingFilesToLoad = FILES_TO_LOAD.length;
  const hasFinishedLoading = () => remainingFilesToLoad <= 0;
  let onLoadCallbacks = [];

  window.textsecure = window.textsecure || {};
  window.textsecure.protobuf = {
    onLoad: callback => {
      if (hasFinishedLoading()) {
        setTimeout(callback, 0);
      } else {
        onLoadCallbacks.push(callback);
      }
    },
  };

  FILES_TO_LOAD.forEach(filename => {
    dcodeIO.ProtoBuf.loadProtoFile(
      { root: window.PROTO_ROOT, file: filename },
      (error, result) => {
        if (error) {
          const text = `Error loading protos from ${filename} (root: ${
            window.PROTO_ROOT
          }) ${error && error.stack ? error.stack : error}`;
          window.log.error(text);
          throw error;
        }
        const protos = result.build('signalservice');
        if (!protos) {
          const text = `Error loading protos from ${filename} - no exported types! (root: ${window.PROTO_ROOT})`;
          window.log.error(text);
          throw new Error(text);
        }
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const protoName in protos) {
          textsecure.protobuf[protoName] = protos[protoName];
        }

        remainingFilesToLoad -= 1;
        if (hasFinishedLoading()) {
          onLoadCallbacks.forEach(callback => callback());
          onLoadCallbacks = [];
        }
      }
    );
  });
})();

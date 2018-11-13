/* global window, dcodeIO, textsecure */

// eslint-disable-next-line func-names
(function() {
  window.textsecure = window.textsecure || {};
  window.textsecure.protobuf = {};

  function loadProtoBufs(filename) {
    return dcodeIO.ProtoBuf.loadProtoFile(
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
          const text = `Error loading protos from ${filename} (root: ${
            window.PROTO_ROOT
          })`;
          window.log.error(text);
          throw new Error(text);
        }
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const protoName in protos) {
          textsecure.protobuf[protoName] = protos[protoName];
        }
      }
    );
  }

  loadProtoBufs('SignalService.proto');
  loadProtoBufs('SubProtocol.proto');
  loadProtoBufs('DeviceMessages.proto');

  // Metadata-specific protos
  loadProtoBufs('UnidentifiedDelivery.proto');
})();

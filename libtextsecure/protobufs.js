;(function() {
    'use strict';
    window.textsecure = window.textsecure || {};
    window.textsecure.protobuf = {};

    function loadProtoBufs(filename) {
        return dcodeIO.ProtoBuf.loadProtoFile({root: 'protos', file: filename}, function(error, result) {
           if (error) {
              throw error;
           }
           var protos = result.build('textsecure');
           for (var protoName in protos) {
              textsecure.protobuf[protoName] = protos[protoName];
           }
        });
    };

    loadProtoBufs('IncomingPushMessageSignal.proto');
    loadProtoBufs('SubProtocol.proto');
    loadProtoBufs('DeviceMessages.proto');
})();

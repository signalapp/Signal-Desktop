;(function() {

    function loadProtoBufs(filename) {
        return dcodeIO.ProtoBuf.loadProtoFile({root: 'protos', file: filename}).build('textsecure');
    };

    var pushMessages     = loadProtoBufs('IncomingPushMessageSignal.proto');
    var protocolMessages = loadProtoBufs('WhisperTextProtocol.proto');
    var deviceMessages   = loadProtoBufs('DeviceMessages.proto');

    window.textsecure = window.textsecure || {};
    window.textsecure.protobuf = {
        IncomingPushMessageSignal : pushMessages.IncomingPushMessageSignal,
        PushMessageContent        : pushMessages.PushMessageContent,
        WhisperMessage            : protocolMessages.WhisperMessage,
        PreKeyWhisperMessage      : protocolMessages.PreKeyWhisperMessage,
        DeviceInit                : deviceMessages.DeviceInit,
        IdentityKey               : deviceMessages.IdentityKey,
        DeviceControl             : deviceMessages.DeviceControl
    };
})();

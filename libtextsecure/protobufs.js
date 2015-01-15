;(function() {

    function loadProtoBufs(filename) {
        return dcodeIO.ProtoBuf.loadProtoFile({root: 'protos', file: filename}).build('textsecure');
    };

    var pushMessages     = loadProtoBufs('IncomingPushMessageSignal.proto');
    var subProtocolMessages = loadProtoBufs('SubProtocol.proto');
    var deviceMessages   = loadProtoBufs('DeviceMessages.proto');

    window.textsecure = window.textsecure || {};
    window.textsecure.protobuf = {
        IncomingPushMessageSignal : pushMessages.IncomingPushMessageSignal,
        PushMessageContent        : pushMessages.PushMessageContent,
        ProvisioningUuid          : deviceMessages.ProvisioningUuid,
        ProvisionEnvelope         : deviceMessages.ProvisionEnvelope,
        ProvisionMessage          : deviceMessages.ProvisionMessage,
        DeviceControl             : deviceMessages.DeviceControl,
        WebSocketResponseMessage  : subProtocolMessages.WebSocketResponseMessage,
        WebSocketRequestMessage   : subProtocolMessages.WebSocketRequestMessage,
        WebSocketMessage          : subProtocolMessages.WebSocketMessage
    };
})();

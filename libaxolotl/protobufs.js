;(function() {
    function loadProtoBufs(filename) {
        return dcodeIO.ProtoBuf.loadProtoFile({root: 'protos', file: filename}).build('textsecure');
    };

    var protocolMessages = loadProtoBufs('WhisperTextProtocol.proto');
    var deviceMessages   = loadProtoBufs('DeviceMessages.proto');

    window.axolotl = window.axolotl || {};
    window.axolotl.protobuf = {
        WhisperMessage            : protocolMessages.WhisperMessage,
        PreKeyWhisperMessage      : protocolMessages.PreKeyWhisperMessage,
        DeviceInit                : deviceMessages.DeviceInit,
        IdentityKey               : deviceMessages.IdentityKey,
        DeviceControl             : deviceMessages.DeviceControl,
    };
})();

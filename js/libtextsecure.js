;(function() {

    function loadProtoBufs(filename) {
        return dcodeIO.ProtoBuf.loadProtoFile({root: 'protos', file: filename}).build('textsecure');
    };

    var pushMessages     = loadProtoBufs('IncomingPushMessageSignal.proto');
    var protocolMessages = loadProtoBufs('WhisperTextProtocol.proto');
    var subProtocolMessages = loadProtoBufs('SubProtocol.proto');
    var deviceMessages   = loadProtoBufs('DeviceMessages.proto');

    window.textsecure = window.textsecure || {};
    window.textsecure.protobuf = {
        IncomingPushMessageSignal : pushMessages.IncomingPushMessageSignal,
        PushMessageContent        : pushMessages.PushMessageContent,
        WhisperMessage            : protocolMessages.WhisperMessage,
        PreKeyWhisperMessage      : protocolMessages.PreKeyWhisperMessage,
        DeviceInit                : deviceMessages.DeviceInit,
        IdentityKey               : deviceMessages.IdentityKey,
        DeviceControl             : deviceMessages.DeviceControl,
        WebSocketResponseMessage  : subProtocolMessages.WebSocketResponseMessage,
        WebSocketRequestMessage   : subProtocolMessages.WebSocketRequestMessage,
        WebSocketMessage          : subProtocolMessages.WebSocketMessage
    };
})();

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function(){
    'use strict';

    /*
     * var socket = textsecure.websocket(url);
     *
     * Returns an adamantium-reinforced super socket, capable of sending
     * app-level keep alives and automatically reconnecting.
     *
     */

    window.textsecure.websocket = function (url) {
        var socketWrapper = {
            onmessage    : function() {},
            ondisconnect : function() {},
        };
        var socket;
        var keepAliveTimer;
        var reconnectSemaphore = 0;
        var reconnectTimeout = 1000;

        function resetKeepAliveTimer() {
            clearTimeout(keepAliveTimer);
            keepAliveTimer = setTimeout(function() {
                socket.send(
                    new textsecure.protobuf.WebSocketMessage({
                        type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
                        request: { verb: 'GET', path: '/v1/keepalive' }
                    }).encode().toArrayBuffer()
                );

                resetKeepAliveTimer();
            }, 15000);
        };

        function reconnect(e) {
            reconnectSemaphore--;
            setTimeout(connect, reconnectTimeout);
            socketWrapper.ondisconnect(e);
        };

        function connect() {
            clearTimeout(keepAliveTimer);
            if (++reconnectSemaphore <= 0) { return; }

            if (socket) { socket.close(); }
            socket = new WebSocket(url);

            socket.onerror = reconnect;
            socket.onclose = reconnect;
            socket.onopen  = resetKeepAliveTimer;

            socket.onmessage = function(response) {
                socketWrapper.onmessage(response);
                resetKeepAliveTimer();
            };

            socketWrapper.send = function(msg) {
                socket.send(msg);
            }
        }

        connect();
        return socketWrapper;
    };
})();

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function(){
    'use strict';

    /*
     * WebSocket-Resources
     *
     * Create a request-response interface over websockets using the
     * WebSocket-Resources sub-protocol[1].
     *
     * var client = new WebSocketResource(socket, function(request) {
     *    request.respond(200, 'OK');
     * });
     *
     * client.sendRequest({
     *    verb: 'PUT',
     *    path: '/v1/messages',
     *    body: '{ some: "json" }',
     *    success: function(message, status, request) {...},
     *    error: function(message, status, request) {...}
     * });
     *
     * 1. https://github.com/WhisperSystems/WebSocket-Resources
     *
     */

    var Request = function(options) {
        this.verb    = options.verb || options.type;
        this.path    = options.path || options.url;
        this.body    = options.body || options.data;
        this.success = options.success
        this.error   = options.error
        this.id      = options.id;

        if (this.id === undefined) {
            var bits = new Uint32Array(2);
            window.crypto.getRandomValues(bits);
            this.id = dcodeIO.Long.fromBits(bits[0], bits[1], true);
        }
    };

    var IncomingWebSocketRequest = function(options) {
        var request = new Request(options);
        var socket = options.socket;

        this.verb = request.verb;
        this.path = request.path;
        this.body = request.body;

        this.respond = function(status, message) {
            socket.send(
                new textsecure.protobuf.WebSocketMessage({
                    type: textsecure.protobuf.WebSocketMessage.Type.RESPONSE,
                    response: { id: request.id, message: message, status: status }
                }).encode().toArrayBuffer()
            );
        };
    };

    var outgoing = {};
    var OutgoingWebSocketRequest = function(options, socket) {
        var request = new Request(options);
        outgoing[request.id] = request;
        socket.send(
            new textsecure.protobuf.WebSocketMessage({
                type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
                request: {
                    verb : request.verb,
                    path : request.path,
                    body : request.body,
                    id   : request.id
                }
            }).encode().toArrayBuffer()
        );
    };

    window.WebSocketResource = function(socket, handleRequest) {
        this.sendRequest = function(options) {
            return new OutgoingWebSocketRequest(options, socket);
        };

        socket.onmessage = function(socketMessage) {
            var blob = socketMessage.data;
            var reader = new FileReader();
            reader.onload = function() {
                var message = textsecure.protobuf.WebSocketMessage.decode(reader.result);
                if (message.type === textsecure.protobuf.WebSocketMessage.Type.REQUEST ) {
                    handleRequest(
                        new IncomingWebSocketRequest({
                            verb   : message.request.verb,
                            path   : message.request.path,
                            body   : message.request.body,
                            id     : message.request.id,
                            socket : socket
                        })
                    );
                }
                else if (message.type === textsecure.protobuf.WebSocketMessage.Type.RESPONSE ) {
                    var response = message.response;
                    var request = outgoing[response.id];
                    if (request) {
                        request.response = response;
                        var callback = request.error;
                        if (response.status >= 200 && response.status < 300) {
                            callback = request.success;
                        }

                        if (typeof callback === 'function') {
                            callback(response.message, response.status, request);
                        }
                    } else {
                        throw 'Received response for unknown request ' + message.response.id;
                    }
                }
            };
            reader.readAsArrayBuffer(blob);
        };
    };

}());

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

window.textsecure = window.textsecure || {};

/*********************************
 *** Type conversion utilities ***
 *********************************/
// Strings/arrays
//TODO: Throw all this shit in favor of consistent types
//TODO: Namespace
var StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
var StaticArrayBufferProto = new ArrayBuffer().__proto__;
var StaticUint8ArrayProto = new Uint8Array().__proto__;
function getString(thing) {
    if (thing === Object(thing)) {
        if (thing.__proto__ == StaticUint8ArrayProto)
            return String.fromCharCode.apply(null, thing);
        if (thing.__proto__ == StaticArrayBufferProto)
            return getString(new Uint8Array(thing));
        if (thing.__proto__ == StaticByteBufferProto)
            return thing.toString("binary");
    }
    return thing;
}

function getStringable(thing) {
    return (typeof thing == "string" || typeof thing == "number" || typeof thing == "boolean" ||
            (thing === Object(thing) &&
                (thing.__proto__ == StaticArrayBufferProto ||
                thing.__proto__ == StaticUint8ArrayProto ||
                thing.__proto__ == StaticByteBufferProto)));
}

function isEqual(a, b, mayBeShort) {
    // TODO: Special-case arraybuffers, etc
    if (a === undefined || b === undefined)
        return false;
    a = getString(a);
    b = getString(b);
    var maxLength = mayBeShort ? Math.min(a.length, b.length) : Math.max(a.length, b.length);
    if (maxLength < 5)
        throw new Error("a/b compare too short");
    return a.substring(0, Math.min(maxLength, a.length)) == b.substring(0, Math.min(maxLength, b.length));
}

function toArrayBuffer(thing) {
    //TODO: Optimize this for specific cases
    if (thing === undefined)
        return undefined;
    if (thing === Object(thing) && thing.__proto__ == StaticArrayBufferProto)
        return thing;

    if (thing instanceof Array) {
        // Assuming Uint16Array from curve25519
        var res = new ArrayBuffer(thing.length * 2);
        var uint = new Uint16Array(res);
        for (var i = 0; i < thing.length; i++)
            uint[i] = thing[i];
        return res;
    }

    if (!getStringable(thing))
        throw new Error("Tried to convert a non-stringable thing of type " + typeof thing + " to an array buffer");
    var str = getString(thing);
    var res = new ArrayBuffer(str.length);
    var uint = new Uint8Array(res);
    for (var i = 0; i < str.length; i++)
        uint[i] = str.charCodeAt(i);
    return res;
}

// Number formatting utils
window.textsecure.utils = function() {
    var self = {};
    self.unencodeNumber = function(number) {
        return number.split(".");
    };

    self.isNumberSane = function(number) {
        return number[0] == "+" &&
            /^[0-9]+$/.test(number.substring(1));
    }

    /**************************
     *** JSON'ing Utilities ***
     **************************/
    function ensureStringed(thing) {
        if (getStringable(thing))
            return getString(thing);
        else if (thing instanceof Array) {
            var res = [];
            for (var i = 0; i < thing.length; i++)
                res[i] = ensureStringed(thing[i]);
            return res;
        } else if (thing === Object(thing)) {
            var res = {};
            for (var key in thing)
                res[key] = ensureStringed(thing[key]);
            return res;
        }
        throw new Error("unsure of how to jsonify object of type " + typeof thing);

    }

    self.jsonThing = function(thing) {
        return JSON.stringify(ensureStringed(thing));
    }

    return self;
}();

window.textsecure.throwHumanError = function(error, type, humanError) {
    var e = new Error(error);
    if (type !== undefined)
        e.name = type;
    e.humanError = humanError;
    throw e;
}

var handleAttachment = function(attachment) {
    function getAttachment() {
        return textsecure.api.getAttachment(attachment.id.toString());
    }

    function decryptAttachment(encrypted) {
        return textsecure.protocol.decryptAttachment(
            encrypted,
            attachment.key.toArrayBuffer()
        );
    }

    function updateAttachment(data) {
        attachment.data = data;
    }

    return getAttachment().
      then(decryptAttachment).
      then(updateAttachment);
};

textsecure.processDecrypted = function(decrypted, source) {

    // Now that its decrypted, validate the message and clean it up for consumer processing
    // Note that messages may (generally) only perform one action and we ignore remaining fields
    // after the first action.

    if (decrypted.flags == null)
        decrypted.flags = 0;

    if ((decrypted.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
        return;
    if (decrypted.flags != 0) {
        throw new Error("Unknown flags in message");
    }

    var promises = [];

    if (decrypted.group !== null) {
        decrypted.group.id = getString(decrypted.group.id);
        var existingGroup = textsecure.storage.groups.getNumbers(decrypted.group.id);
        if (existingGroup === undefined) {
            if (decrypted.group.type != textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE) {
                throw new Error("Got message for unknown group");
            }
            textsecure.storage.groups.createNewGroup(decrypted.group.members, decrypted.group.id);
            if (decrypted.group.avatar !== null) {
                promises.push(handleAttachment(decrypted.group.avatar));
            }
        } else {
            var fromIndex = existingGroup.indexOf(source);

            if (fromIndex < 0) {
                //TODO: This could be indication of a race...
                throw new Error("Sender was not a member of the group they were sending from");
            }

            switch(decrypted.group.type) {
            case textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE:
                if (decrypted.group.avatar !== null)
                    promises.push(handleAttachment(decrypted.group.avatar));

                if (decrypted.group.members.filter(function(number) { return !textsecure.utils.isNumberSane(number); }).length != 0)
                    throw new Error("Invalid number in new group members");

                if (existingGroup.filter(function(number) { decrypted.group.members.indexOf(number) < 0 }).length != 0)
                    throw new Error("Attempted to remove numbers from group with an UPDATE");
                decrypted.group.added = decrypted.group.members.filter(function(number) { return existingGroup.indexOf(number) < 0; });

                var newGroup = textsecure.storage.groups.addNumbers(decrypted.group.id, decrypted.group.added);
                if (newGroup.length != decrypted.group.members.length ||
                    newGroup.filter(function(number) { return decrypted.group.members.indexOf(number) < 0; }).length != 0) {
                    throw new Error("Error calculating group member difference");
                }

                //TODO: Also follow this path if avatar + name haven't changed (ie we should start storing those)
                if (decrypted.group.avatar === null && decrypted.group.added.length == 0 && decrypted.group.name === null) {
                    return;
                }

                decrypted.body = null;
                decrypted.attachments = [];

                break;
            case textsecure.protobuf.PushMessageContent.GroupContext.Type.QUIT:
                textsecure.storage.groups.removeNumber(decrypted.group.id, source);

                decrypted.body = null;
                decrypted.attachments = [];
            case textsecure.protobuf.PushMessageContent.GroupContext.Type.DELIVER:
                decrypted.group.name = null;
                decrypted.group.members = [];
                decrypted.group.avatar = null;

                break;
            default:
                throw new Error("Unknown group message type");
            }
        }
    }

    for (var i in decrypted.attachments) {
        promises.push(handleAttachment(decrypted.attachments[i]));
    }
    return Promise.all(promises).then(function() {
        return decrypted;
    });
}

window.textsecure.registerSingleDevice = function(number, verificationCode, stepDone) {
    var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
    textsecure.storage.putEncrypted('signaling_key', signalingKey);

    var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
    password = password.substring(0, password.length - 2);
    textsecure.storage.putEncrypted("password", password);

    var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
    registrationId = registrationId & 0x3fff;
    textsecure.storage.putUnencrypted("registrationId", registrationId);

    return textsecure.api.confirmCode(number, verificationCode, password, signalingKey, registrationId, true).then(function() {
        var numberId = number + ".1";
        textsecure.storage.putUnencrypted("number_id", numberId);
        textsecure.storage.putUnencrypted("regionCode", libphonenumber.util.getRegionCodeForNumber(number));
        stepDone(1);

        return textsecure.protocol.generateKeys().then(function(keys) {
            stepDone(2);
            return textsecure.api.registerKeys(keys).then(function() {
                stepDone(3);
            });
        });
    });
}

window.textsecure.registerSecondDevice = function(encodedDeviceInit, cryptoInfo, stepDone) {
    var deviceInit = textsecure.protobuf.DeviceInit.decode(encodedDeviceInit, 'binary');
    return cryptoInfo.decryptAndHandleDeviceInit(deviceInit).then(function(identityKey) {
        if (identityKey.server != textsecure.api.relay)
            throw new Error("Unknown relay used by master");
        var number = identityKey.phoneNumber;

        stepDone(1);

        var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
        textsecure.storage.putEncrypted('signaling_key', signalingKey);

        var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
        password = password.substring(0, password.length - 2);
        textsecure.storage.putEncrypted("password", password);

        var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
        registrationId = registrationId & 0x3fff;
        textsecure.storage.putUnencrypted("registrationId", registrationId);

        return textsecure.api.confirmCode(number, identityKey.provisioningCode, password, signalingKey, registrationId, false).then(function(result) {
            var numberId = number + "." + result;
            textsecure.storage.putUnencrypted("number_id", numberId);
            textsecure.storage.putUnencrypted("regionCode", libphonenumber.util.getRegion(number));
            stepDone(2);

            return textsecure.protocol.generateKeys().then(function(keys) {
                stepDone(3);
                return textsecure.api.registerKeys(keys).then(function() {
                    stepDone(4);
                    //TODO: Send DeviceControl.NEW_DEVICE_REGISTERED to all other devices
                });
            });
        });
    });
};

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

;(function() {
    'use strict';

    var registeredFunctions = {};
    var Type = {
        SEND_MESSAGE: 1,
        INIT_SESSION: 2,
    };
    window.textsecure = window.textsecure || {};
    window.textsecure.replay = {
        Type: Type,
        registerFunction: function(func, functionCode) {
            registeredFunctions[functionCode] = func;
        }
    };

    function ReplayableError(options) {
        options = options || {};
        this.name         = options.name || 'ReplayableError';
        this.functionCode = options.functionCode;
        this.args         = options.args;
    }
    ReplayableError.prototype = new Error();
    ReplayableError.prototype.constructor = ReplayableError;

    ReplayableError.prototype.replay = function() {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        args = this.args.concat(args);

        registeredFunctions[this.functionCode].apply(window, args);
    };

    function IncomingIdentityKeyError(number, message) {
        ReplayableError.call(this, {
            functionCode : Type.INIT_SESSION,
            args         : [number, message]
        });
        this.name = 'IncomingIdentityKeyError';
        this.message = "The identity of the sender has changed. This may be malicious, or the sender may have simply reinstalled TextSecure.";
    }
    IncomingIdentityKeyError.prototype = new ReplayableError();
    IncomingIdentityKeyError.prototype.constructor = IncomingIdentityKeyError;

    function OutgoingIdentityKeyError(number, message) {
        ReplayableError.call(this, {
            functionCode : Type.SEND_MESSAGE,
            args         : [number, message]
        });
        this.name = 'OutgoingIdentityKeyError';
        this.message = "The identity of the destination has changed. This may be malicious, or the destination may have simply reinstalled TextSecure.";
    }
    OutgoingIdentityKeyError.prototype = new ReplayableError();
    OutgoingIdentityKeyError.prototype.constructor = OutgoingIdentityKeyError;

    window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
    window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
    window.textsecure.ReplayableError = ReplayableError;

})();

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function() {
    "use strict";

    window.StringView = {

      /*
      * These functions from the Mozilla Developer Network
      * and have been placed in the public domain.
      * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
      * https://developer.mozilla.org/en-US/docs/MDN/About#Copyrights_and_licenses
      */

      b64ToUint6: function(nChr) {
        return nChr > 64 && nChr < 91 ?
            nChr - 65
          : nChr > 96 && nChr < 123 ?
            nChr - 71
          : nChr > 47 && nChr < 58 ?
            nChr + 4
          : nChr === 43 ?
            62
          : nChr === 47 ?
            63
          :
            0;
      },

      base64ToBytes: function(sBase64, nBlocksSize) {
        var
          sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
          nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2;
        var aBBytes = new ArrayBuffer(nOutLen);
        var taBytes = new Uint8Array(aBBytes);

        for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
          nMod4 = nInIdx & 3;
          nUint24 |= StringView.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
          if (nMod4 === 3 || nInLen - nInIdx === 1) {
            for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
              taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
            }
            nUint24 = 0;
          }
        }
        return aBBytes;
      },

      uint6ToB64: function(nUint6) {
        return nUint6 < 26 ?
            nUint6 + 65
          : nUint6 < 52 ?
            nUint6 + 71
          : nUint6 < 62 ?
            nUint6 - 4
          : nUint6 === 62 ?
            43
          : nUint6 === 63 ?
            47
          :
            65;
      },

      bytesToBase64: function(aBytes) {
        var nMod3, sB64Enc = "";
        for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
          nMod3 = nIdx % 3;
          if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n"; }
          nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
          if (nMod3 === 2 || aBytes.length - nIdx === 1) {
            sB64Enc += String.fromCharCode(
                            StringView.uint6ToB64(nUint24 >>> 18 & 63),
                            StringView.uint6ToB64(nUint24 >>> 12 & 63),
                            StringView.uint6ToB64(nUint24 >>> 6 & 63),
                            StringView.uint6ToB64(nUint24 & 63)
                      );
            nUint24 = 0;
          }
        }
        return sB64Enc.replace(/A(?=A$|$)/g, "=");
      }
    };
}());

/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

;(function() {

    /************************************************
    *** Utilities to store data in local storage ***
    ************************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage = {

        /*****************************
        *** Base Storage Routines ***
        *****************************/
        putEncrypted: function(key, value) {
            //TODO
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("e" + key, textsecure.utils.jsonThing(value));
        },

        getEncrypted: function(key, defaultValue) {
            //TODO
            var value = localStorage.getItem("e" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        removeEncrypted: function(key) {
            localStorage.removeItem("e" + key);
        },

        putUnencrypted: function(key, value) {
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("u" + key, textsecure.utils.jsonThing(value));
        },

        getUnencrypted: function(key, defaultValue) {
            var value = localStorage.getItem("u" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        removeUnencrypted: function(key) {
            localStorage.removeItem("u" + key);
        }
    };
})();


/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

;(function() {
    /**********************
    *** Device Storage ***
    **********************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.devices = {
        saveDeviceObject: function(deviceObject) {
            return internalSaveDeviceObject(deviceObject, false);
        },

        saveKeysToDeviceObject: function(deviceObject) {
            return internalSaveDeviceObject(deviceObject, true);
        },

        getDeviceObjectsForNumber: function(number) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            return map === undefined ? [] : map.devices;
        },

        getDeviceObject: function(encodedNumber) {
            var number = textsecure.utils.unencodeNumber(encodedNumber);
            var devices = textsecure.storage.devices.getDeviceObjectsForNumber(number[0]);
            if (devices === undefined)
                return undefined;

            for (var i in devices)
                if (devices[i].encodedNumber == encodedNumber)
                    return devices[i];

            return undefined;
        },

        removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            if (map === undefined)
                throw new Error("Tried to remove device for unknown number");

            var newDevices = [];
            var devicesRemoved = 0;
            for (var i in map.devices) {
                var keep = true;
                for (var j in deviceIdsToRemove)
                    if (map.devices[i].encodedNumber == number + "." + deviceIdsToRemove[j])
                        keep = false;

                if (keep)
                    newDevices.push(map.devices[i]);
                else
                    devicesRemoved++;
            }

            if (devicesRemoved != deviceIdsToRemove.length)
                throw new Error("Tried to remove unknown device");
        }
    };

    var internalSaveDeviceObject = function(deviceObject, onlyKeys) {
        if (deviceObject.identityKey === undefined || deviceObject.encodedNumber === undefined)
            throw new Error("Tried to store invalid deviceObject");

        var number = textsecure.utils.unencodeNumber(deviceObject.encodedNumber)[0];
        var map = textsecure.storage.getEncrypted("devices" + number);

        if (map === undefined)
            map = { devices: [deviceObject], identityKey: deviceObject.identityKey };
        else if (map.identityKey != getString(deviceObject.identityKey))
            throw new Error("Identity key changed");
        else {
            var updated = false;
            for (var i in map.devices) {
                if (map.devices[i].encodedNumber == deviceObject.encodedNumber) {
                    if (!onlyKeys)
                        map.devices[i] = deviceObject;
                    else {
                        map.devices[i].preKey = deviceObject.preKey;
                        map.devices[i].preKeyId = deviceObject.preKeyId;
                        map.devices[i].signedKey = deviceObject.signedKey;
                        map.devices[i].signedKeyId = deviceObject.signedKeyId;
                        map.devices[i].registrationId = deviceObject.registrationId;
                    }
                    updated = true;
                }
            }

            if (!updated)
                map.devices.push(deviceObject);
        }

        textsecure.storage.putEncrypted("devices" + number, map);
    };
})();

/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

;(function() {
    /*********************
     *** Group Storage ***
     *********************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.groups = {
        getGroupListForNumber: function(number) {
            return textsecure.storage.getEncrypted("groupMembership" + number, []);
        },

        createNewGroup: function(numbers, groupId) {
            if (groupId !== undefined && textsecure.storage.getEncrypted("group" + groupId) !== undefined) {
                throw new Error("Tried to recreate group");
            }

            while (groupId === undefined || textsecure.storage.getEncrypted("group" + groupId) !== undefined) {
                groupId = getString(textsecure.crypto.getRandomBytes(16));
            }

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            var haveMe = false;
            var finalNumbers = [];
            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in group");
                if (number == me)
                    haveMe = true;
                if (finalNumbers.indexOf(number) < 0) {
                    finalNumbers.push(number);
                    addGroupToNumber(groupId, number);
                }
            }

            if (!haveMe)
                finalNumbers.push(me);

            textsecure.storage.putEncrypted("group" + groupId, {numbers: finalNumbers});

            return {id: groupId, numbers: finalNumbers};
        },

        getNumbers: function(groupId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            return group.numbers;
        },

        removeNumber: function(groupId, number) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            if (number == me)
                throw new Error("Cannot remove ourselves from a group, leave the group instead");

            var i = group.numbers.indexOf(number);
            if (i > -1) {
                group.numbers.slice(i, 1);
                textsecure.storage.putEncrypted("group" + groupId, group);
                removeGroupFromNumber(groupId, number);
            }

            return group.numbers;
        },

        addNumbers: function(groupId, numbers) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in set to add to group");
                if (group.numbers.indexOf(number) < 0) {
                    group.numbers.push(number);
                    addGroupToNumber(groupId, number);
                }
            }

            textsecure.storage.putEncrypted("group" + groupId, group);
            return group.numbers;
        },

        deleteGroup: function(groupId) {
            textsecure.storage.removeEncrypted("group" + groupId);
        },

        getGroup: function(groupId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            return { id: groupId, numbers: group.numbers }; //TODO: avatar/name tracking
        }
    };

    var addGroupToNumber = function(groupId, number) {
        var membership = textsecure.storage.getEncrypted("groupMembership" + number, [groupId]);
        if (membership.indexOf(groupId) < 0)
            membership.push(groupId);
        textsecure.storage.putEncrypted("groupMembership" + number, membership);
    }

    var removeGroupFromNumber = function(groupId, number) {
        var membership = textsecure.storage.getEncrypted("groupMembership" + number, [groupId]);
        membership = membership.filter(function(group) { return group != groupId; });
        if (membership.length == 0)
            textsecure.storage.removeEncrypted("groupMembership" + number);
        else
            textsecure.storage.putEncrypted("groupMembership" + number, membership);
    }

})();

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

window.textsecure = window.textsecure || {};

window.textsecure.api = function () {
    'use strict';

    var self = {};

    /************************************************
     *** Utilities to communicate with the server ***
     ************************************************/
    // Staging server
    var URL_BASE    = "https://textsecure-service-staging.whispersystems.org";
    self.relay      = "textsecure-service-staging.whispersystems.org";
    var ATTACHMENT_HOST = "whispersystems-textsecure-attachments-staging.s3.amazonaws.com";

    // This is the real server
    //var URL_BASE  = "https://textsecure-service.whispersystems.org";

    var URL_CALLS = {};
    URL_CALLS.accounts   = "/v1/accounts";
    URL_CALLS.devices    = "/v1/devices";
    URL_CALLS.keys       = "/v2/keys";
    URL_CALLS.push       = "/v1/websocket";
    URL_CALLS.temp_push  = "/v1/temp_websocket";
    URL_CALLS.messages   = "/v1/messages";
    URL_CALLS.attachment = "/v1/attachments";

    /**
        * REQUIRED PARAMS:
        *   call:               URL_CALLS entry
        *   httpType:           POST/GET/PUT/etc
        * OPTIONAL PARAMS:
        *   success_callback:   function(response object) called on success
        *   error_callback:     function(http status code = -1 or != 200) called on failure
        *   urlParameters:      crap appended to the url (probably including a leading /)
        *   user:               user name to be sent in a basic auth header
        *   password:           password to be sent in a basic auth headerA
        *   do_auth:            alternative to user/password where user/password are figured out automagically
        *   jsonData:           JSON data sent in the request body
        */
    var doAjax = function (param) {
        if (param.urlParameters === undefined) {
            param.urlParameters = "";
        }

        if (param.do_auth) {
            param.user      = textsecure.storage.getUnencrypted("number_id");
            param.password  = textsecure.storage.getEncrypted("password");
        }

        return new Promise(function (resolve, reject) {
            $.ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
                type        : param.httpType,
                data        : param.jsonData && textsecure.utils.jsonThing(param.jsonData),
                contentType : 'application/json; charset=utf-8',
                dataType    : 'json',

                beforeSend  : function (xhr) {
                                if (param.user       !== undefined &&
                                    param.password !== undefined)
                                        xhr.setRequestHeader("Authorization", "Basic " + btoa(getString(param.user) + ":" + getString(param.password)));
                                },

                success     : function(response, textStatus, jqXHR) {
                                    resolve(response);
                                },

                error       : function(jqXHR, textStatus, errorThrown) {
                    var code = jqXHR.status;
                    if (code === 200) {
                        // happens sometimes when we get no response
                        // (TODO: Fix server to return 204? instead)
                        resolve(null);
                        return;
                    }
                    if (code > 999 || code < 100)
                        code = -1;
                    try {
                        switch (code) {
                        case -1:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Failed to connect to the server, please check your network connection.");
                        case 413:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Rate limit exceeded, please try again later.");
                        case 403:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Invalid code, please try again.");
                        case 417:
                            // TODO: This shouldn't be a thing?, but its in the API doc?
                            textsecure.throwHumanError(code, "HTTPError",
                                "Number already registered.");
                        case 401:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Invalid authentication, most likely someone re-registered and invalidated our registration.");
                        case 404:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Number is not registered with TextSecure.");
                        default:
                            textsecure.throwHumanError(code, "HTTPError",
                                "The server rejected our query, please file a bug report.");
                        }
                    } catch (e) {
                        if (jqXHR.responseJSON)
                            e.response = jqXHR.responseJSON;
                        reject(e);
                    }
                }
            });
        });
    };

    function requestVerificationCode(number, transport) {
        return doAjax({
            call                : 'accounts',
            httpType            : 'GET',
            urlParameters       : '/' + transport + '/code/' + number,
        });
    };
    self.requestVerificationSMS = function(number) {
        return requestVerificationCode(number, 'sms');
    };
    self.requestVerificationVoice = function(number) {
        return requestVerificationCode(number, 'voice');
    };

    self.confirmCode = function(number, code, password,
                                signaling_key, registrationId, single_device) {
            var call = single_device ? 'accounts' : 'devices';
            var urlPrefix = single_device ? '/code/' : '/';

            return doAjax({
                call                : call,
                httpType            : 'PUT',
                urlParameters       : urlPrefix + code,
                user                : number,
                password            : password,
                jsonData            : { signalingKey        : btoa(getString(signaling_key)),
                                            supportsSms     : false,
                                            fetchesMessages : true,
                                            registrationId  : registrationId}
            });
    };

    self.registerKeys = function(genKeys) {
        var keys = {};
        keys.identityKey = btoa(getString(genKeys.identityKey));
        keys.signedPreKey = {keyId: genKeys.signedPreKey.keyId, publicKey: btoa(getString(genKeys.signedPreKey.publicKey)),
                            signature: btoa(getString(genKeys.signedPreKey.signature))};

        keys.preKeys = [];
        var j = 0;
        for (var i in genKeys.preKeys)
            keys.preKeys[j++] = {keyId: i, publicKey: btoa(getString(genKeys.preKeys[i].publicKey))};

        //TODO: This is just to make the server happy (v2 clients should choke on publicKey),
        // it needs removed before release
        keys.lastResortKey = {keyId: 0x7fffFFFF, publicKey: btoa("42")};

        return doAjax({
            call                : 'keys',
            httpType            : 'PUT',
            do_auth             : true,
            jsonData            : keys,
        });
    };

    self.getKeysForNumber = function(number, deviceId) {
        if (deviceId === undefined)
            deviceId = "*";

        return doAjax({
            call                : 'keys',
            httpType            : 'GET',
            do_auth             : true,
            urlParameters       : "/" + number + "/" + deviceId,
        }).then(function(res) {
            var promises = [];
            res.identityKey = StringView.base64ToBytes(res.identityKey);
            for (var i = 0; i < res.devices.length; i++) {
                res.devices[i].signedPreKey.publicKey = StringView.base64ToBytes(res.devices[i].signedPreKey.publicKey);
                res.devices[i].signedPreKey.signature = StringView.base64ToBytes(res.devices[i].signedPreKey.signature);
                promises[i] = window.textsecure.crypto.Ed25519Verify(res.identityKey, res.devices[i].signedPreKey.publicKey, res.devices[i].signedPreKey.signature);
                res.devices[i].preKey.publicKey = StringView.base64ToBytes(res.devices[i].preKey.publicKey);
                //TODO: Is this still needed?
                //if (res.devices[i].keyId === undefined)
                //  res.devices[i].keyId = 0;
            }
            return Promise.all(promises).then(function() {
                return res;
            });
        });
    };

    self.sendMessages = function(destination, messageArray) {
        //TODO: Do this conversion somewhere else?
        for (var i = 0; i < messageArray.length; i++)
            messageArray[i].body = btoa(messageArray[i].body);
        var jsonData = { messages: messageArray };
        if (messageArray[0].relay !== undefined)
            jsonData.relay = messageArray[0].relay;
        jsonData.timestamp = messageArray[0].timestamp;

        return doAjax({
            call                : 'messages',
            httpType            : 'PUT',
            urlParameters       : '/' + destination,
            do_auth             : true,
            jsonData            : jsonData,
        });
    };

    self.getAttachment = function(id) {
        return doAjax({
            call                : 'attachment',
            httpType            : 'GET',
            urlParameters       : '/' + id,
            do_auth             : true,
        }).then(function(response) {
            return new Promise(function(resolve, reject) {
                $.ajax(response.location, {
                    type        : "GET",
                    xhrFields: {
                        responseType: "arraybuffer"
                    },
                    headers: {
                        "Content-Type": "application/octet-stream"
                    },

                    success     : function(response, textStatus, jqXHR) {
                                        resolve(response);
                                    },

                    error       : function(jqXHR, textStatus, errorThrown) {
                                        var code = jqXHR.status;
                                        if (code > 999 || code < 100)
                                            code = -1;

                                        var e = new Error(code);
                                        e.name = "HTTPError";
                                        if (jqXHR.responseJSON)
                                            e.response = jqXHR.responseJSON;
                                        reject(e);
                                    }
                });
            });
        });
    };

    var id_regex = RegExp( "^https:\/\/" + ATTACHMENT_HOST + "\/(\\d+)\?");
    self.putAttachment = function(encryptedBin) {
        return doAjax({
            call     : 'attachment',
            httpType : 'GET',
            do_auth  : true,
        }).then(function(response) {
            return new Promise(function(resolve, reject) {
                $.ajax(response.location, {
                    type        : "PUT",
                    headers     : {"Content-Type" : "application/octet-stream"},
                    data        : encryptedBin,
                    processData : false,
                    success     : function() {
                        try {
                            // Parse the id as a string from the location url
                            // (workaround for ids too large for Javascript numbers)
                            var id = response.location.match(id_regex)[1];
                            resolve(id);
                        } catch(e) {
                            reject(e);
                        }
                    },
                    error   : function(jqXHR, textStatus, errorThrown) {
                        var code = jqXHR.status;
                        if (code > 999 || code < 100)
                            code = -1;

                        var e = new Error(code);
                        e.name = "HTTPError";
                        if (jqXHR.responseJSON)
                            e.response = jqXHR.responseJSON;
                        reject(e);
                    }
                });
            });
        });
    };

    var getWebsocket = function(url, auth, reconnectTimeout) {
        var URL = URL_BASE.replace(/^http/g, 'ws') + url + '/?';
        var params = '';
        if (auth) {
            var user = textsecure.storage.getUnencrypted("number_id");
            var password = textsecure.storage.getEncrypted("password");
            var params = $.param({
                login: '+' + user.substring(1),
                password: password
            });
        }
        return window.textsecure.websocket(URL+params)
    }

    self.getMessageWebsocket = function() {
        return getWebsocket(URL_CALLS['push'], true, 1000);
    }

    self.getTempWebsocket = function() {
        //XXX
        var socketWrapper = { onmessage: function() {}, ondisconnect: function() {}, onconnect: function() {} };
        setTimeout(function() {
            socketWrapper.onmessage({uuid: "404-42-magic"});
        }, 1000);
        return socketWrapper;
        //return getWebsocket(URL_CALLS['temp_push'], false, 5000);
    }

    return self;
}();

/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function() {
    window.textsecure = window.textsecure || {};

    /*
     *  textsecure.crypto
     *    glues together various implementations into a single interface
     *    for all low-level crypto operations,
     */

    function curve25519() {
        // use native client opportunistically, since it's faster
        return textsecure.nativeclient || window.curve25519;
    }

    window.textsecure.crypto = {
        getRandomBytes: function(size) {
            // At some point we might consider XORing in hashes of random
            // UI events to strengthen ourselves against RNG flaws in crypto.getRandomValues
            // ie maybe take a look at how Gibson does it at https://www.grc.com/r&d/js.htm
            var array = new Uint8Array(size);
            window.crypto.getRandomValues(array);
            return array.buffer;
        },
        encrypt: function(key, data, iv) {
            return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['encrypt']).then(function(key) {
                return window.crypto.subtle.encrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
            });
        },
        decrypt: function(key, data, iv) {
            return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['decrypt']).then(function(key) {
                return window.crypto.subtle.decrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
            });
        },
        sign: function(key, data) {
            return window.crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: 'SHA-256'}}, false, ['sign']).then(function(key) {
                return window.crypto.subtle.sign( {name: 'HMAC', hash: 'SHA-256'}, key, data);
            });
        },

        HKDF: function(input, salt, info) {
            // Specific implementation of RFC 5869 that only returns the first 3 32-byte chunks
            // TODO: We dont always need the third chunk, we might skip it
            return window.textsecure.crypto.sign(salt, input).then(function(PRK) {
                var infoBuffer = new ArrayBuffer(info.byteLength + 1 + 32);
                var infoArray = new Uint8Array(infoBuffer);
                infoArray.set(new Uint8Array(info), 32);
                infoArray[infoArray.length - 1] = 1;
                return window.textsecure.crypto.sign(PRK, infoBuffer.slice(32)).then(function(T1) {
                    infoArray.set(new Uint8Array(T1));
                    infoArray[infoArray.length - 1] = 2;
                    return window.textsecure.crypto.sign(PRK, infoBuffer).then(function(T2) {
                        infoArray.set(new Uint8Array(T2));
                        infoArray[infoArray.length - 1] = 3;
                        return window.textsecure.crypto.sign(PRK, infoBuffer).then(function(T3) {
                            return [ T1, T2, T3 ];
                        });
                    });
                });
            });
        },

        // Curve 25519 crypto
        createKeyPair: function(privKey) {
            if (privKey === undefined) {
                privKey = textsecure.crypto.getRandomBytes(32);
            }
            if (privKey.byteLength != 32) {
                throw new Error("Invalid private key");
            }

            return curve25519().keyPair(privKey).then(function(raw_keys) {
                // prepend version byte
                var origPub = new Uint8Array(raw_keys.pubKey);
                var pub = new Uint8Array(33);
                pub.set(origPub, 1);
                pub[0] = 5;

                return { pubKey: pub.buffer, privKey: raw_keys.privKey };
            });
        },
        ECDHE: function(pubKey, privKey) {
            pubKey = validatePubKeyFormat(pubKey);
            if (privKey === undefined || privKey.byteLength != 32)
                throw new Error("Invalid private key");

            if (pubKey === undefined || pubKey.byteLength != 32)
                throw new Error("Invalid public key");

            return curve25519().sharedSecret(pubKey, privKey);
        },
        Ed25519Sign: function(privKey, message) {
            if (privKey === undefined || privKey.byteLength != 32)
                throw new Error("Invalid private key");

            if (message === undefined)
                throw new Error("Invalid message");

            return curve25519().sign(privKey, message);
        },
        Ed25519Verify: function(pubKey, msg, sig) {
            pubKey = validatePubKeyFormat(pubKey);

            if (pubKey === undefined || pubKey.byteLength != 32)
                throw new Error("Invalid public key");

            if (msg === undefined)
                throw new Error("Invalid message");

            if (sig === undefined || sig.byteLength != 64)
                throw new Error("Invalid signature");

            return curve25519().verify(pubKey, msg, sig);
        }
    };

    var validatePubKeyFormat = function(pubKey) {
        if (pubKey === undefined || ((pubKey.byteLength != 33 || new Uint8Array(pubKey)[0] != 5) && pubKey.byteLength != 32))
            throw new Error("Invalid public key");
        if (pubKey.byteLength == 33) {
            return pubKey.slice(1);
        } else {
            console.error("WARNING: Expected pubkey of length 33, please report the ST and client that generated the pubkey");
            return pubKey;
        }
    };

})();

/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function() {

'use strict';
window.textsecure = window.textsecure || {};

window.textsecure.protocol = function() {
    var self = {};

    /******************************
    *** Random constants/utils ***
    ******************************/
    // We consider messages lost after a week and might throw away keys at that point
    // (also the time between signedPreKey regenerations)
    var MESSAGE_LOST_THRESHOLD_MS = 1000*60*60*24*7;

    function objectContainsKeys(object) {
        var count = 0;
        for (var key in object) {
            count++;
            break;
        }
        return count != 0;
    }

    /***************************
    *** Key/session storage ***
    ***************************/
    var crypto_storage = {};

    crypto_storage.putKeyPair = function(keyName, keyPair) {
        textsecure.storage.putEncrypted("25519Key" + keyName, keyPair);
    }

    crypto_storage.getNewStoredKeyPair = function(keyName) {
        return textsecure.crypto.createKeyPair().then(function(keyPair) {
            crypto_storage.putKeyPair(keyName, keyPair);
            return keyPair;
        });
    }

    crypto_storage.getStoredKeyPair = function(keyName) {
        var res = textsecure.storage.getEncrypted("25519Key" + keyName);
        if (res === undefined)
            return undefined;
        return { pubKey: toArrayBuffer(res.pubKey), privKey: toArrayBuffer(res.privKey) };
    }

    crypto_storage.removeStoredKeyPair = function(keyName) {
        textsecure.storage.removeEncrypted("25519Key" + keyName);
    }

    crypto_storage.getIdentityKey = function() {
        return this.getStoredKeyPair("identityKey");
    }

    crypto_storage.saveSession = function(encodedNumber, session, registrationId) {
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined)
            device = { sessions: {}, encodedNumber: encodedNumber };

        if (registrationId !== undefined)
            device.registrationId = registrationId;

        crypto_storage.saveSessionAndDevice(device, session);
    }

    crypto_storage.saveSessionAndDevice = function(device, session) {
        if (device.sessions === undefined)
            device.sessions = {};
        var sessions = device.sessions;

        var doDeleteSession = false;
        if (session.indexInfo.closed == -1 || device.identityKey === undefined)
            device.identityKey = session.indexInfo.remoteIdentityKey;

        if (session.indexInfo.closed != -1) {
            doDeleteSession = (session.indexInfo.closed < (new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS));

            if (!doDeleteSession) {
                var keysLeft = false;
                for (var key in session) {
                    if (key != "indexInfo" && key != "oldRatchetList" && key != "currentRatchet") {
                        keysLeft = true;
                        break;
                    }
                }
                doDeleteSession = !keysLeft;
                console.log((doDeleteSession ? "Deleting " : "Not deleting ") + "closed session which has not yet timed out");
            } else
                console.log("Deleting closed session due to timeout (created at " + session.indexInfo.closed + ")");
        }

        if (doDeleteSession)
            delete sessions[getString(session.indexInfo.baseKey)];
        else
            sessions[getString(session.indexInfo.baseKey)] = session;

        var openSessionRemaining = false;
        for (var key in sessions)
            if (sessions[key].indexInfo.closed == -1)
                openSessionRemaining = true;
        if (!openSessionRemaining)
            try {
                delete device['registrationId'];
            } catch(_) {}

        textsecure.storage.devices.saveDeviceObject(device);
    }

    var getSessions = function(encodedNumber) {
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined || device.sessions === undefined)
            return undefined;
        return device.sessions;
    }

    crypto_storage.getOpenSession = function(encodedNumber) {
        var sessions = getSessions(encodedNumber);
        if (sessions === undefined)
            return undefined;

        for (var key in sessions)
            if (sessions[key].indexInfo.closed == -1)
                return sessions[key];
        return undefined;
    }

    crypto_storage.getSessionByRemoteEphemeralKey = function(encodedNumber, remoteEphemeralKey) {
        var sessions = getSessions(encodedNumber);
        if (sessions === undefined)
            return undefined;

        var searchKey = getString(remoteEphemeralKey);

        var openSession = undefined;
        for (var key in sessions) {
            if (sessions[key].indexInfo.closed == -1) {
                if (openSession !== undefined)
                    throw new Error("Datastore inconsistensy: multiple open sessions for " + encodedNumber);
                openSession = sessions[key];
            }
            if (sessions[key][searchKey] !== undefined)
                return sessions[key];
        }
        if (openSession !== undefined)
            return openSession;

        return undefined;
    }

    crypto_storage.getSessionOrIdentityKeyByBaseKey = function(encodedNumber, baseKey) {
        var sessions = getSessions(encodedNumber);
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined)
            return undefined;

        var preferredSession = device.sessions && device.sessions[getString(baseKey)];
        if (preferredSession !== undefined)
            return preferredSession;

        if (device.identityKey !== undefined)
            return { indexInfo: { remoteIdentityKey: device.identityKey } };

        throw new Error("Datastore inconsistency: device was stored without identity key");
    }

    /*****************************
    *** Internal Crypto stuff ***
    *****************************/
    var HKDF = function(input, salt, info) {
        // HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
        if (salt == '')
            salt = new ArrayBuffer(32);
        if (salt.byteLength != 32)
            throw new Error("Got salt of incorrect length");

        info = toArrayBuffer(info); // TODO: maybe convert calls?

        return textsecure.crypto.HKDF(input, salt, info);
    }

    var verifyMAC = function(data, key, mac) {
        return textsecure.crypto.sign(key, data).then(function(calculated_mac) {
            if (!isEqual(calculated_mac, mac, true))
                throw new Error("Bad MAC");
        });
    }

    /******************************
    *** Ratchet implementation ***
    ******************************/
    var calculateRatchet = function(session, remoteKey, sending) {
        var ratchet = session.currentRatchet;

        return textsecure.crypto.ECDHE(remoteKey, toArrayBuffer(ratchet.ephemeralKeyPair.privKey)).then(function(sharedSecret) {
            return HKDF(sharedSecret, toArrayBuffer(ratchet.rootKey), "WhisperRatchet").then(function(masterKey) {
                if (sending)
                    session[getString(ratchet.ephemeralKeyPair.pubKey)] = { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
                else
                    session[getString(remoteKey)]                       = { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
                ratchet.rootKey = masterKey[0];
            });
        });
    }

    var initSession = function(isInitiator, ourEphemeralKey, ourSignedKey, encodedNumber, theirIdentityPubKey, theirEphemeralPubKey, theirSignedPubKey) {
        var ourIdentityKey = crypto_storage.getIdentityKey();

        if (isInitiator) {
            if (ourSignedKey !== undefined)
                throw new Error("Invalid call to initSession");
            ourSignedKey = ourEphemeralKey;
        } else {
            if (theirSignedPubKey !== undefined)
                throw new Error("Invalid call to initSession");
            theirSignedPubKey = theirEphemeralPubKey;
        }

        var sharedSecret;
        if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined)
            sharedSecret = new Uint8Array(32 * 4);
        else
            sharedSecret = new Uint8Array(32 * 5);

        for (var i = 0; i < 32; i++)
            sharedSecret[i] = 0xff;

        return textsecure.crypto.ECDHE(theirSignedPubKey, ourIdentityKey.privKey).then(function(ecRes1) {
            function finishInit() {
                return textsecure.crypto.ECDHE(theirSignedPubKey, ourSignedKey.privKey).then(function(ecRes) {
                    sharedSecret.set(new Uint8Array(ecRes), 32 * 3);

                    return HKDF(sharedSecret.buffer, '', "WhisperText").then(function(masterKey) {
                        var session = {currentRatchet: { rootKey: masterKey[0], lastRemoteEphemeralKey: theirSignedPubKey, previousCounter: 0 },
                                        indexInfo: { remoteIdentityKey: theirIdentityPubKey, closed: -1 },
                                        oldRatchetList: []
                                    };
                        if (!isInitiator)
                            session.indexInfo.baseKey = theirEphemeralPubKey;
                        else
                            session.indexInfo.baseKey = ourEphemeralKey.pubKey;

                        // If we're initiating we go ahead and set our first sending ephemeral key now,
                        // otherwise we figure it out when we first maybeStepRatchet with the remote's ephemeral key
                        if (isInitiator) {
                            return textsecure.crypto.createKeyPair().then(function(ourSendingEphemeralKey) {
                                session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
                                return calculateRatchet(session, theirSignedPubKey, true).then(function() {
                                    return session;
                                });
                            });
                        } else {
                            session.currentRatchet.ephemeralKeyPair = ourSignedKey;
                            return session;
                        }
                    });
                });
            }

            var promise;
            if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined)
                promise = Promise.resolve(new ArrayBuffer(0));
            else
                promise = textsecure.crypto.ECDHE(theirEphemeralPubKey, ourEphemeralKey.privKey);
            return promise.then(function(ecRes4) {
                sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);

                if (isInitiator)
                    return textsecure.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32);
                        sharedSecret.set(new Uint8Array(ecRes2), 32 * 2);
                    }).then(finishInit);
                else
                    return textsecure.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32 * 2);
                        sharedSecret.set(new Uint8Array(ecRes2), 32)
                    }).then(finishInit);
            });
        });
    }

    var removeOldChains = function(session) {
        // Sending ratchets are always removed when we step because we never need them again
        // Receiving ratchets are either removed if we step with all keys used up to previousCounter
        // and are otherwise added to the oldRatchetList, which we parse here and remove ratchets
        // older than a week (we assume the message was lost and move on with our lives at that point)
        var newList = [];
        for (var i = 0; i < session.oldRatchetList.length; i++) {
            var entry = session.oldRatchetList[i];
            var ratchet = getString(entry.ephemeralKey);
            console.log("Checking old chain with added time " + (entry.added/1000));
            if ((!objectContainsKeys(session[ratchet].messageKeys) && (session[ratchet].chainKey === undefined || session[ratchet].chainKey.key === undefined))
                    || entry.added < new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS) {
                delete session[ratchet];
                console.log("...deleted");
            } else
                newList[newList.length] = entry;
        }
        session.oldRatchetList = newList;
    }

    var closeSession = function(session, sessionClosedByRemote) {
        if (session.indexInfo.closed > -1)
            return;

        // After this has run, we can still receive messages on ratchet chains which
        // were already open (unless we know we dont need them),
        // but we cannot send messages or step the ratchet

        // Delete current sending ratchet
        delete session[getString(session.currentRatchet.ephemeralKeyPair.pubKey)];
        // Move all receive ratchets to the oldRatchetList to mark them for deletion
        for (var i in session) {
            if (session[i].chainKey !== undefined && session[i].chainKey.key !== undefined) {
                if (!sessionClosedByRemote)
                    session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: i };
                else
                    delete session[i].chainKey.key;
            }
        }
        // Delete current root key and our ephemeral key pair to disallow ratchet stepping
        delete session.currentRatchet['rootKey'];
        delete session.currentRatchet['ephemeralKeyPair'];
        session.indexInfo.closed = new Date().getTime();
        removeOldChains(session);
    }

    self.closeOpenSessionForDevice = function(encodedNumber) {
        var session = crypto_storage.getOpenSession(encodedNumber);
        if (session === undefined)
            return;

        closeSession(session);
        crypto_storage.saveSession(encodedNumber, session);
    }

    var initSessionFromPreKeyWhisperMessage;
    var decryptWhisperMessage;
    var handlePreKeyWhisperMessage = function(from, encodedMessage) {
        var preKeyProto = textsecure.protobuf.PreKeyWhisperMessage.decode(encodedMessage, 'binary');
        return initSessionFromPreKeyWhisperMessage(from, preKeyProto).then(function(sessions) {
            return decryptWhisperMessage(from, getString(preKeyProto.message), sessions[0], preKeyProto.registrationId).then(function(result) {
                if (sessions[1] !== undefined)
                    sessions[1]();
                return result;
            });
        });
    }

    var wipeIdentityAndTryMessageAgain = function(from, encodedMessage, message_id) {
        // Wipe identity key!
        textsecure.storage.removeEncrypted("devices" + from.split('.')[0]);
        return handlePreKeyWhisperMessage(from, encodedMessage).then(
            function(pushMessageContent) {
                extension.trigger('message:decrypted', {
                    message_id : message_id,
                    data       : pushMessageContent
                });
            }
        );
    }
    textsecure.replay.registerFunction(wipeIdentityAndTryMessageAgain, textsecure.replay.Type.INIT_SESSION);

    initSessionFromPreKeyWhisperMessage = function(encodedNumber, message) {
        var preKeyPair = crypto_storage.getStoredKeyPair("preKey" + message.preKeyId);
        var signedPreKeyPair = crypto_storage.getStoredKeyPair("signedKey" + message.signedPreKeyId);

        var session = crypto_storage.getSessionOrIdentityKeyByBaseKey(encodedNumber, toArrayBuffer(message.baseKey));
        var open_session = crypto_storage.getOpenSession(encodedNumber);
        if (signedPreKeyPair === undefined) {
            // Session may or may not be the right one, but if its not, we can't do anything about it
            // ...fall through and let decryptWhisperMessage handle that case
            if (session !== undefined && session.currentRatchet !== undefined)
                return Promise.resolve([session, undefined]);
            else
                throw new Error("Missing Signed PreKey for PreKeyWhisperMessage");
        }
        if (session !== undefined) {
            // Duplicate PreKeyMessage for session:
            if (isEqual(session.indexInfo.baseKey, message.baseKey, false))
                return Promise.resolve([session, undefined]);

            // We already had a session/known identity key:
            if (isEqual(session.indexInfo.remoteIdentityKey, message.identityKey, false)) {
                // If the identity key matches the previous one, close the previous one and use the new one
                if (open_session !== undefined)
                    closeSession(open_session); // To be returned and saved later
            } else {
                // ...otherwise create an error that the UI will pick up and ask the user if they want to re-negotiate
                throw new textsecure.IncomingIdentityKeyError(encodedNumber, getString(message.encode()));
            }
        }
        return initSession(false, preKeyPair, signedPreKeyPair, encodedNumber, toArrayBuffer(message.identityKey), toArrayBuffer(message.baseKey), undefined)
                        .then(function(new_session) {
            // Note that the session is not actually saved until the very end of decryptWhisperMessage
            // ... to ensure that the sender actually holds the private keys for all reported pubkeys
            return [new_session, function() {
                if (open_session !== undefined)
                    crypto_storage.saveSession(encodedNumber, open_session);
                crypto_storage.removeStoredKeyPair("preKey" + message.preKeyId);
            }];
        });;
    }

    var fillMessageKeys = function(chain, counter) {
        if (chain.chainKey.counter + 1000 < counter) //TODO: maybe 1000 is too low/high in some cases?
            return Promise.resolve(); // Stalker, much?

        if (chain.chainKey.counter >= counter)
            return Promise.resolve(); // Already calculated

        if (chain.chainKey.key === undefined)
            throw new Error("Got invalid request to extend chain after it was already closed");

        var key = toArrayBuffer(chain.chainKey.key);
        var byteArray = new Uint8Array(1);
        byteArray[0] = 1;
        return textsecure.crypto.sign(key, byteArray.buffer).then(function(mac) {
            byteArray[0] = 2;
            return textsecure.crypto.sign(key, byteArray.buffer).then(function(key) {
                chain.messageKeys[chain.chainKey.counter + 1] = mac;
                chain.chainKey.key = key
                chain.chainKey.counter += 1;
                return fillMessageKeys(chain, counter);
            });
        });
    }

    var maybeStepRatchet = function(session, remoteKey, previousCounter) {
        if (session[getString(remoteKey)] !== undefined)
            return Promise.resolve();

        var ratchet = session.currentRatchet;

        var finish = function() {
            return calculateRatchet(session, remoteKey, false).then(function() {
                // Now swap the ephemeral key and calculate the new sending chain
                var previousRatchet = getString(ratchet.ephemeralKeyPair.pubKey);
                if (session[previousRatchet] !== undefined) {
                    ratchet.previousCounter = session[previousRatchet].chainKey.counter;
                    delete session[previousRatchet];
                }

                return textsecure.crypto.createKeyPair().then(function(keyPair) {
                    ratchet.ephemeralKeyPair = keyPair;
                    return calculateRatchet(session, remoteKey, true).then(function() {
                        ratchet.lastRemoteEphemeralKey = remoteKey;
                    });
                });
            });
        }

        var previousRatchet = session[getString(ratchet.lastRemoteEphemeralKey)];
        if (previousRatchet !== undefined) {
            return fillMessageKeys(previousRatchet, previousCounter).then(function() {
                delete previousRatchet.chainKey.key;
                if (!objectContainsKeys(previousRatchet.messageKeys))
                    delete session[getString(ratchet.lastRemoteEphemeralKey)];
                else
                    session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: ratchet.lastRemoteEphemeralKey };
            }).then(finish);
        } else
            return finish();
    }

    // returns decrypted protobuf
    decryptWhisperMessage = function(encodedNumber, messageBytes, session, registrationId) {
        if (messageBytes[0] != String.fromCharCode((3 << 4) | 3))
            throw new Error("Bad version number on WhisperMessage");

        var messageProto = messageBytes.substring(1, messageBytes.length - 8);
        var mac = messageBytes.substring(messageBytes.length - 8, messageBytes.length);

        var message = textsecure.protobuf.WhisperMessage.decode(messageProto, 'binary');
        var remoteEphemeralKey = toArrayBuffer(message.ephemeralKey);

        if (session === undefined) {
            var session = crypto_storage.getSessionByRemoteEphemeralKey(encodedNumber, remoteEphemeralKey);
            if (session === undefined)
                throw new Error("No session found to decrypt message from " + encodedNumber);
        }

        return maybeStepRatchet(session, remoteEphemeralKey, message.previousCounter).then(function() {
            var chain = session[getString(message.ephemeralKey)];

            return fillMessageKeys(chain, message.counter).then(function() {
                return HKDF(toArrayBuffer(chain.messageKeys[message.counter]), '', "WhisperMessageKeys").then(function(keys) {
                    delete chain.messageKeys[message.counter];

                    var messageProtoArray = toArrayBuffer(messageProto);
                    var macInput = new Uint8Array(messageProtoArray.byteLength + 33*2 + 1);
                    macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)));
                    macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)), 33);
                    macInput[33*2] = (3 << 4) | 3;
                    macInput.set(new Uint8Array(messageProtoArray), 33*2 + 1);

                    return verifyMAC(macInput.buffer, keys[1], mac).then(function() {
                        return window.textsecure.crypto.decrypt(keys[0], toArrayBuffer(message.ciphertext), keys[2].slice(0, 16))
                                    .then(function(paddedPlaintext) {

                            paddedPlaintext = new Uint8Array(paddedPlaintext);
                            var plaintext;
                            for (var i = paddedPlaintext.length - 1; i >= 0; i--) {
                                if (paddedPlaintext[i] == 0x80) {
                                    plaintext = new Uint8Array(i);
                                    plaintext.set(paddedPlaintext.subarray(0, i));
                                    plaintext = plaintext.buffer;
                                    break;
                                } else if (paddedPlaintext[i] != 0x00)
                                    throw new Error('Invalid padding');
                            }

                            delete session['pendingPreKey'];

                            var finalMessage = textsecure.protobuf.PushMessageContent.decode(plaintext);

                            if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                                    == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                                closeSession(session, true);

                            removeOldChains(session);

                            crypto_storage.saveSession(encodedNumber, session, registrationId);
                            return finalMessage;
                        });
                    });
                });
            });
        });
    }

    /*************************
    *** Public crypto API ***
    *************************/
    // Decrypts message into a raw string
    self.decryptWebsocketMessage = function(message) {
        var signaling_key = textsecure.storage.getEncrypted("signaling_key"); //TODO: in crypto_storage
        var aes_key = toArrayBuffer(signaling_key.substring(0, 32));
        var mac_key = toArrayBuffer(signaling_key.substring(32, 32 + 20));

        var decodedMessage = message.toArrayBuffer();
        if (new Uint8Array(decodedMessage)[0] != 1)
            throw new Error("Got bad version number: " + decodedMessage[0]);

        var iv = decodedMessage.slice(1, 1 + 16);
        var ciphertext = decodedMessage.slice(1 + 16, decodedMessage.byteLength - 10);
        var ivAndCiphertext = decodedMessage.slice(0, decodedMessage.byteLength - 10);
        var mac = decodedMessage.slice(decodedMessage.byteLength - 10, decodedMessage.byteLength);

        return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
            return window.textsecure.crypto.decrypt(aes_key, ciphertext, iv);
        });
    };

    self.decryptAttachment = function(encryptedBin, keys) {
        var aes_key = keys.slice(0, 32);
        var mac_key = keys.slice(32, 64);

        var iv = encryptedBin.slice(0, 16);
        var ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
        var ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
        var mac = encryptedBin.slice(encryptedBin.byteLength - 32, encryptedBin.byteLength);

        return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
            return window.textsecure.crypto.decrypt(aes_key, ciphertext, iv);
        });
    };

    self.encryptAttachment = function(plaintext, keys, iv) {
        var aes_key = keys.slice(0, 32);
        var mac_key = keys.slice(32, 64);

        return window.textsecure.crypto.encrypt(aes_key, plaintext, iv).then(function(ciphertext) {
            var ivAndCiphertext = new Uint8Array(16 + ciphertext.byteLength);
            ivAndCiphertext.set(new Uint8Array(iv));
            ivAndCiphertext.set(new Uint8Array(ciphertext), 16);

            return textsecure.crypto.sign(mac_key, ivAndCiphertext.buffer).then(function(mac) {
                var encryptedBin = new Uint8Array(16 + ciphertext.byteLength + 32);
                encryptedBin.set(ivAndCiphertext);
                encryptedBin.set(new Uint8Array(mac), 16 + ciphertext.byteLength);
                return encryptedBin.buffer;
            });
        });
    };

    self.handleIncomingPushMessageProto = function(proto) {
        switch(proto.type) {
        case textsecure.protobuf.IncomingPushMessageSignal.Type.PLAINTEXT:
            return Promise.resolve(textsecure.protobuf.PushMessageContent.decode(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT:
            var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
            return decryptWhisperMessage(from, getString(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE:
            if (proto.message.readUint8() != ((3 << 4) | 3))
                throw new Error("Bad version byte");
            var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
            return handlePreKeyWhisperMessage(from, getString(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT:
            return Promise.resolve(null);
        default:
            return new Promise(function(resolve, reject) { reject(new Error("Unknown message type")); });
        }
    }

    // return Promise(encoded [PreKey]WhisperMessage)
    self.encryptMessageFor = function(deviceObject, pushMessageContent) {
        var session = crypto_storage.getOpenSession(deviceObject.encodedNumber);

        var doEncryptPushMessageContent = function() {
            var msg = new textsecure.protobuf.WhisperMessage();
            var plaintext = toArrayBuffer(pushMessageContent.encode());

            var paddedPlaintext = new Uint8Array(Math.ceil((plaintext.byteLength + 1) / 160.0) * 160 - 1);
            paddedPlaintext.set(new Uint8Array(plaintext));
            paddedPlaintext[plaintext.byteLength] = 0x80;

            msg.ephemeralKey = toArrayBuffer(session.currentRatchet.ephemeralKeyPair.pubKey);
            var chain = session[getString(msg.ephemeralKey)];

            return fillMessageKeys(chain, chain.chainKey.counter + 1).then(function() {
                return HKDF(toArrayBuffer(chain.messageKeys[chain.chainKey.counter]), '', "WhisperMessageKeys").then(function(keys) {
                    delete chain.messageKeys[chain.chainKey.counter];
                    msg.counter = chain.chainKey.counter;
                    msg.previousCounter = session.currentRatchet.previousCounter;

                    return window.textsecure.crypto.encrypt(keys[0], paddedPlaintext.buffer, keys[2].slice(0, 16)).then(function(ciphertext) {
                        msg.ciphertext = ciphertext;
                        var encodedMsg = toArrayBuffer(msg.encode());

                        var macInput = new Uint8Array(encodedMsg.byteLength + 33*2 + 1);
                        macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)));
                        macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)), 33);
                        macInput[33*2] = (3 << 4) | 3;
                        macInput.set(new Uint8Array(encodedMsg), 33*2 + 1);

                        return textsecure.crypto.sign(keys[1], macInput.buffer).then(function(mac) {
                            var result = new Uint8Array(encodedMsg.byteLength + 9);
                            result[0] = (3 << 4) | 3;
                            result.set(new Uint8Array(encodedMsg), 1);
                            result.set(new Uint8Array(mac, 0, 8), encodedMsg.byteLength + 1);

                            try {
                                delete deviceObject['signedKey'];
                                delete deviceObject['signedKeyId'];
                                delete deviceObject['preKey'];
                                delete deviceObject['preKeyId'];
                            } catch(_) {}

                            removeOldChains(session);

                            crypto_storage.saveSessionAndDevice(deviceObject, session);
                            return result;
                        });
                    });
                });
            });
        }

        var preKeyMsg = new textsecure.protobuf.PreKeyWhisperMessage();
        preKeyMsg.identityKey = toArrayBuffer(crypto_storage.getIdentityKey().pubKey);
        preKeyMsg.registrationId = textsecure.storage.getUnencrypted("registrationId");

        if (session === undefined) {
            return textsecure.crypto.createKeyPair().then(function(baseKey) {
                preKeyMsg.preKeyId = deviceObject.preKeyId;
                preKeyMsg.signedPreKeyId = deviceObject.signedKeyId;
                preKeyMsg.baseKey = toArrayBuffer(baseKey.pubKey);
                return initSession(true, baseKey, undefined, deviceObject.encodedNumber,
                                    toArrayBuffer(deviceObject.identityKey), toArrayBuffer(deviceObject.preKey), toArrayBuffer(deviceObject.signedKey))
                            .then(function(new_session) {
                    session = new_session;
                    session.pendingPreKey = { preKeyId: deviceObject.preKeyId, signedKeyId: deviceObject.signedKeyId, baseKey: baseKey.pubKey };
                    return doEncryptPushMessageContent().then(function(message) {
                        preKeyMsg.message = message;
                        var result = String.fromCharCode((3 << 4) | 3) + getString(preKeyMsg.encode());
                        return {type: 3, body: result};
                    });
                });
            });
        } else
            return doEncryptPushMessageContent().then(function(message) {
                if (session.pendingPreKey !== undefined) {
                    preKeyMsg.baseKey = toArrayBuffer(session.pendingPreKey.baseKey);
                    preKeyMsg.preKeyId = session.pendingPreKey.preKeyId;
                    preKeyMsg.signedPreKeyId = session.pendingPreKey.signedKeyId;
                    preKeyMsg.message = message;

                    var result = String.fromCharCode((3 << 4) | 3) + getString(preKeyMsg.encode());
                    return {type: 3, body: result};
                } else
                    return {type: 1, body: getString(message)};
            });
    }

    var GENERATE_KEYS_KEYS_GENERATED = 100;
    self.generateKeys = function() {
        var identityKeyPair = crypto_storage.getIdentityKey();
        var identityKeyCalculated = function(identityKeyPair) {
            var firstPreKeyId = textsecure.storage.getEncrypted("maxPreKeyId", 0);
            textsecure.storage.putEncrypted("maxPreKeyId", firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED);

            var signedKeyId = textsecure.storage.getEncrypted("signedKeyId", 0);
            textsecure.storage.putEncrypted("signedKeyId", signedKeyId + 1);

            var keys = {};
            keys.identityKey = identityKeyPair.pubKey;
            keys.preKeys = [];

            var generateKey = function(keyId) {
                return crypto_storage.getNewStoredKeyPair("preKey" + keyId, false).then(function(keyPair) {
                    keys.preKeys[keyId] = {keyId: keyId, publicKey: keyPair.pubKey};
                });
            };

            var promises = [];
            for (var i = firstPreKeyId; i < firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED; i++)
                promises[i] = generateKey(i);

            promises[firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED] = crypto_storage.getNewStoredKeyPair("signedKey" + signedKeyId).then(function(keyPair) {
                return textsecure.crypto.Ed25519Sign(identityKeyPair.privKey, keyPair.pubKey).then(function(sig) {
                    keys.signedPreKey = {keyId: signedKeyId, publicKey: keyPair.pubKey, signature: sig};
                });
            });

            //TODO: Process by date added and agressively call generateKeys when we get near maxPreKeyId in a message
            crypto_storage.removeStoredKeyPair("signedKey" + (signedKeyId - 2));

            return Promise.all(promises).then(function() {
                return keys;
            });
        }
        if (identityKeyPair === undefined)
            return crypto_storage.getNewStoredKeyPair("identityKey").then(function(keyPair) { return identityKeyCalculated(keyPair); });
        else
            return identityKeyCalculated(identityKeyPair);
    }

    //TODO: Dont always update prekeys here
    if (textsecure.storage.getEncrypted("lastSignedKeyUpdate", Date.now()) < Date.now() - MESSAGE_LOST_THRESHOLD_MS) {
        new Promise(function(resolve) { resolve(self.generateKeys()); });
    }


    self.prepareTempWebsocket = function() {
        var socketInfo = {};
        var keyPair;

        socketInfo.decryptAndHandleDeviceInit = function(deviceInit) {
            var masterEphemeral = toArrayBuffer(deviceInit.masterEphemeralPubKey);
            var message = toArrayBuffer(deviceInit.identityKeyMessage);

            return textsecure.crypto.ECDHE(masterEphemeral, keyPair.privKey).then(function(ecRes) {
                return HKDF(ecRes, masterEphemeral, "WhisperDeviceInit").then(function(keys) {
                    if (new Uint8Array(message)[0] != (3 << 4) | 3)
                        throw new Error("Bad version number on IdentityKeyMessage");

                    var iv = message.slice(1, 16 + 1);
                    var mac = message.slice(message.length - 32, message.length);
                    var ivAndCiphertext = message.slice(0, message.length - 32);
                    var ciphertext = message.slice(16 + 1, message.length - 32);

                    return verifyMAC(ivAndCiphertext, ecRes[1], mac).then(function() {
                        window.textsecure.crypto.decrypt(ecRes[0], ciphertext, iv).then(function(plaintext) {
                            var identityKeyMsg = textsecure.protobuf.IdentityKey.decode(plaintext);

                            textsecure.crypto.createKeyPair(toArrayBuffer(identityKeyMsg.identityKey)).then(function(identityKeyPair) {
                                crypto_storage.putKeyPair("identityKey", identityKeyPair);
                                identityKeyMsg.identityKey = null;

                                return identityKeyMsg;
                            });
                        });
                    });
                });
            });
        }

        return textsecure.crypto.createKeyPair().then(function(newKeyPair) {
            keyPair = newKeyPair;
            socketInfo.pubKey = keyPair.pubKey;
            return socketInfo;
        });
    }

    return self;
}();

})();

/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
// sendMessage(numbers = [], message = PushMessageContentProto, callback(success/failure map))
window.textsecure.messaging = function() {
    'use strict';

    var self = {};

    function getKeysForNumber(number, updateDevices) {
        var handleResult = function(response) {
            for (var i in response.devices) {
                if (updateDevices === undefined || updateDevices.indexOf(response.devices[i].deviceId) > -1)
                    textsecure.storage.devices.saveKeysToDeviceObject({
                        encodedNumber: number + "." + response.devices[i].deviceId,
                        identityKey: response.identityKey,
                        preKey: response.devices[i].preKey.publicKey,
                        preKeyId: response.devices[i].preKey.keyId,
                        signedKey: response.devices[i].signedPreKey.publicKey,
                        signedKeyId: response.devices[i].signedPreKey.keyId,
                        registrationId: response.devices[i].registrationId
                    });
            }
        };

        var promises = [];
        if (updateDevices !== undefined)
            for (var i in updateDevices)
                promises[promises.length] = textsecure.api.getKeysForNumber(number, updateDevices[i]).then(handleResult);
        else
            return textsecure.api.getKeysForNumber(number).then(handleResult);

        return Promise.all(promises);
    }

    // success_callback(server success/failure map), error_callback(error_msg)
    // message == PushMessageContentProto (NOT STRING)
    function sendMessageToDevices(timestamp, number, deviceObjectList, message, success_callback, error_callback) {
        var jsonData = [];
        var relay = undefined;
        var promises = [];

        var addEncryptionFor = function(i) {
            if (deviceObjectList[i].relay !== undefined) {
                if (relay === undefined)
                    relay = deviceObjectList[i].relay;
                else if (relay != deviceObjectList[i].relay)
                    return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
            } else {
                if (relay === undefined)
                    relay = "";
                else if (relay != "")
                    return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
            }

            return textsecure.protocol.encryptMessageFor(deviceObjectList[i], message).then(function(encryptedMsg) {
                jsonData[i] = {
                    type: encryptedMsg.type,
                    destinationDeviceId: textsecure.utils.unencodeNumber(deviceObjectList[i].encodedNumber)[1],
                    destinationRegistrationId: deviceObjectList[i].registrationId,
                    body: encryptedMsg.body,
                    timestamp: timestamp
                };

                if (deviceObjectList[i].relay !== undefined)
                    jsonData[i].relay = deviceObjectList[i].relay;
            });
        }

        for (var i = 0; i < deviceObjectList.length; i++)
            promises[i] = addEncryptionFor(i);
        return Promise.all(promises).then(function() {
            return textsecure.api.sendMessages(number, jsonData);
        });
    }

    var sendGroupProto;
    var makeAttachmentPointer;
    var refreshGroups = function(number) {
        var groups = textsecure.storage.groups.getGroupListForNumber(number);
        var promises = [];
        for (var i in groups) {
            var group = textsecure.storage.groups.getGroup(groups[i]);

            var proto = new textsecure.protobuf.PushMessageContent();
            proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();

            proto.group.id = toArrayBuffer(group.id);
            proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;
            proto.group.members = group.numbers;
            proto.group.name = group.name === undefined ? null : group.name;

            if (group.avatar !== undefined) {
                return makeAttachmentPointer(group.avatar).then(function(attachment) {
                    proto.group.avatar = attachment;
                    promises.push(sendGroupProto([number], proto));
                });
            } else {
                promises.push(sendGroupProto([number], proto));
            }
        }
        return Promise.all(promises);
    }

    var tryMessageAgain = function(number, encodedMessage, message_id) {
        var message = new Whisper.MessageCollection().add({id: message_id});
        message.fetch().then(function() {
            textsecure.storage.removeEncrypted("devices" + number);
            var proto = textsecure.protobuf.PushMessageContent.decode(encodedMessage, 'binary');
            sendMessageProto(message.get('sent_at'), [number], proto, function(res) {
                if (res.failure.length > 0) {
                    message.set('errors', res.failure);
                }
                else {
                    message.set('errors', []);
                }
                message.save().then(function(){
                    extension.trigger('message', message); // notify frontend listeners
                });
            });
        });
    };
    textsecure.replay.registerFunction(tryMessageAgain, textsecure.replay.Type.SEND_MESSAGE);

    var sendMessageProto = function(timestamp, numbers, message, callback) {
        var numbersCompleted = 0;
        var errors = [];
        var successfulNumbers = [];

        var numberCompleted = function() {
            numbersCompleted++;
            if (numbersCompleted >= numbers.length)
                callback({success: successfulNumbers, failure: errors});
        }

        var registerError = function(number, message, error) {
            if (error) {
                if (error.humanError)
                    message = error.humanError;
            } else
                error = new Error(message);
            errors[errors.length] = { number: number, reason: message, error: error };
            numberCompleted();
        }

        var doSendMessage;
        var reloadDevicesAndSend = function(number, recurse) {
            return function() {
                var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);
                if (devicesForNumber.length == 0)
                    return registerError(number, "Got empty device list when loading device keys", null);
                refreshGroups(number).then(function() {
                    doSendMessage(number, devicesForNumber, recurse);
                });
            }
        }

        doSendMessage = function(number, devicesForNumber, recurse) {
            return sendMessageToDevices(timestamp, number, devicesForNumber, message).then(function(result) {
                successfulNumbers[successfulNumbers.length] = number;
                numberCompleted();
            }).catch(function(error) {
                if (error instanceof Error && error.name == "HTTPError" && (error.message == 410 || error.message == 409)) {
                    if (!recurse)
                        return registerError(number, "Hit retry limit attempting to reload device list", error);

                    if (error.message == 409)
                        textsecure.storage.devices.removeDeviceIdsForNumber(number, error.response.extraDevices);

                    var resetDevices = ((error.message == 410) ? error.response.staleDevices : error.response.missingDevices);
                    getKeysForNumber(number, resetDevices)
                        .then(reloadDevicesAndSend(number, false))
                        .catch(function(error) {
                            if (error.message !== "Identity key changed")
                                registerError(number, "Failed to reload device keys", error);
                            else {
                                error = new textsecure.OutgoingIdentityKeyError(number, getString(message.encode()));
                                registerError(number, "Identity key changed", error);
                            }
                        });
                } else
                    registerError(number, "Failed to create or send message", error);
            });
        }

        for (var i in numbers) {
            var number = numbers[i];
            var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);

            var promises = [];
            for (var j in devicesForNumber)
                if (devicesForNumber[j].registrationId === undefined)
                    promises[promises.length] = getKeysForNumber(number, [parseInt(textsecure.utils.unencodeNumber(devicesForNumber[j].encodedNumber)[1])]);

            Promise.all(promises).then(function() {
                devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);

                if (devicesForNumber.length == 0) {
                    getKeysForNumber(number)
                        .then(reloadDevicesAndSend(number, true))
                        .catch(function(error) {
                            registerError(number, "Failed to retreive new device keys for number " + number, error);
                        });
                } else
                    doSendMessage(number, devicesForNumber, true);
            });
        }
    }

    makeAttachmentPointer = function(attachment) {
        var proto = new textsecure.protobuf.PushMessageContent.AttachmentPointer();
        proto.key = textsecure.crypto.getRandomBytes(64);

        var iv = textsecure.crypto.getRandomBytes(16);
        return textsecure.protocol.encryptAttachment(attachment.data, proto.key, iv).then(function(encryptedBin) {
            return textsecure.api.putAttachment(encryptedBin).then(function(id) {
                proto.id = id;
                proto.contentType = attachment.contentType;
                return proto;
            });
        });
    }

    var sendIndividualProto = function(number, proto, timestamp) {
        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, [number], proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        });
    }

    sendGroupProto = function(numbers, proto, timestamp) {
        timestamp = timestamp || Date.now();
        var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
        numbers = numbers.filter(function(number) { return number != me; });

        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, numbers, proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        });
    }

    self.sendMessageToNumber = function(number, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.body = messageText;

        var promises = [];
        for (var i in attachments)
            promises.push(makeAttachmentPointer(attachments[i]));
        return Promise.all(promises).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return sendIndividualProto(number, proto, timestamp);
        });
    }

    self.closeSession = function(number) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.body = "TERMINATE";
        proto.flags = textsecure.protobuf.PushMessageContent.Flags.END_SESSION;
        return sendIndividualProto(number, proto).then(function(res) {
            var devices = textsecure.storage.devices.getDeviceObjectsForNumber(number);
            for (var i in devices)
                textsecure.protocol.closeOpenSessionForDevice(devices[i].encodedNumber);

            return res;
        });
    }

    self.sendMessageToGroup = function(groupId, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.body = messageText;
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.DELIVER;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });

        var promises = [];
        for (var i in attachments)
            promises.push(makeAttachmentPointer(attachments[i]));
        return Promise.all(promises).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return sendGroupProto(numbers, proto, timestamp);
        });
    }

    self.createGroup = function(numbers, name, avatar) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();

        var group = textsecure.storage.groups.createNewGroup(numbers);
        proto.group.id = toArrayBuffer(group.id);
        var numbers = group.numbers;

        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;
        proto.group.members = numbers;
        proto.group.name = name;

        if (avatar !== undefined) {
            return makeAttachmentPointer(avatar).then(function(attachment) {
                proto.group.avatar = attachment;
                return sendGroupProto(numbers, proto).then(function() {
                    return proto.group.id;
                });
            });
        } else {
            return sendGroupProto(numbers, proto).then(function() {
                return proto.group.id;
            });
        }
    }

    self.addNumberToGroup = function(groupId, number) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;

        var numbers = textsecure.storage.groups.addNumbers(groupId, [number]);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        proto.group.members = numbers;

        return sendGroupProto(numbers, proto);
    }

    self.setGroupName = function(groupId, name) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;
        proto.group.name = name;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        proto.group.members = numbers;

        return sendGroupProto(numbers, proto);
    }

    self.setGroupAvatar = function(groupId, avatar) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        proto.group.members = numbers;

        return makeAttachmentPointer(avatar).then(function(attachment) {
            proto.group.avatar = attachment;
            return sendGroupProto(numbers, proto);
        });
    }

    self.leaveGroup = function(groupId) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.QUIT;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        textsecure.storage.groups.deleteGroup(groupId);

        return sendGroupProto(numbers, proto);
    }

    return self;
}();

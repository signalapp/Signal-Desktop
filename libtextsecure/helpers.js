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

window.textsecure.registerSecondDevice = function(encodedProvisionEnvelope, cryptoInfo, stepDone) {
    var envelope = textsecure.protobuf.ProvisionEnvelope.decode(encodedProvisionEnvelope, 'binary');
    return cryptoInfo.decryptAndHandleDeviceInit(envelope).then(function(identityKey) {
        stepDone(1);

        var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
        textsecure.storage.putEncrypted('signaling_key', signalingKey);

        var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
        password = password.substring(0, password.length - 2);
        textsecure.storage.putEncrypted("password", password);

        var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
        registrationId = registrationId & 0x3fff;
        textsecure.storage.putUnencrypted("registrationId", registrationId);

        return textsecure.api.confirmCode(identityKey.number, identityKey.provisioningCode, password, signalingKey, registrationId, false).then(function(result) {
            var numberId = identityKey.number + "." + result.deviceId;
            textsecure.storage.putUnencrypted("number_id", numberId);
            textsecure.storage.putUnencrypted("regionCode", libphonenumber.util.getRegionCodeForNumber(identityKey.number));
            stepDone(2);

            return textsecure.protocol.generateKeys().then(function(keys) {
                stepDone(3);
                return textsecure.api.registerKeys(keys).then(function() {
                    stepDone(4);
                });
            });
        });
    });
};

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
        } else if (thing === null) {
            return null;
        }
        throw new Error("unsure of how to jsonify object of type " + typeof thing);

    }

    self.jsonThing = function(thing) {
        return JSON.stringify(ensureStringed(thing));
    }

    return self;
}();

function handleAttachment(attachment) {
    function getAttachment() {
        return TextSecureServer.getAttachment(attachment.id.toString());
    }

    function decryptAttachment(encrypted) {
        return textsecure.crypto.decryptAttachment(
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
}

function processDecrypted(decrypted, source) {

    // Now that its decrypted, validate the message and clean it up for consumer processing
    // Note that messages may (generally) only perform one action and we ignore remaining fields
    // after the first action.

    if (decrypted.flags == null)
        decrypted.flags = 0;

    if ((decrypted.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION)
                == textsecure.protobuf.DataMessage.Flags.END_SESSION) {
        decrypted.body = null;
        decrypted.attachments = [];
        decrypted.group = null;
        return Promise.resolve(decrypted);
    }
    if (decrypted.flags != 0) {
        throw new Error("Unknown flags in message");
    }

    var promises = [];

    if (decrypted.group !== null) {
        decrypted.group.id = getString(decrypted.group.id);

        if (decrypted.group.type == textsecure.protobuf.GroupContext.Type.UPDATE) {
            if (decrypted.group.avatar !== null) {
                promises.push(handleAttachment(decrypted.group.avatar));
            }
        }

        promises.push(textsecure.storage.groups.getNumbers(decrypted.group.id).then(function(existingGroup) {
            if (existingGroup === undefined) {
                if (decrypted.group.type != textsecure.protobuf.GroupContext.Type.UPDATE) {
                    throw new Error("Got message for unknown group");
                }
                return textsecure.storage.groups.createNewGroup(decrypted.group.members, decrypted.group.id);
            } else {
                var fromIndex = existingGroup.indexOf(source);

                if (fromIndex < 0) {
                    //TODO: This could be indication of a race...
                    throw new Error("Sender was not a member of the group they were sending from");
                }

                switch(decrypted.group.type) {
                case textsecure.protobuf.GroupContext.Type.UPDATE:
                    return textsecure.storage.groups.updateNumbers(
                        decrypted.group.id, decrypted.group.members
                    ).then(function(added) {
                        decrypted.group.added = added;

                        if (decrypted.group.avatar === null &&
                            decrypted.group.added.length == 0 &&
                            decrypted.group.name === null) {
                            return;
                        }

                        decrypted.body = null;
                        decrypted.attachments = [];
                    });

                    break;
                case textsecure.protobuf.GroupContext.Type.QUIT:
                    decrypted.body = null;
                    decrypted.attachments = [];
                    return textsecure.storage.groups.removeNumber(decrypted.group.id, source);
                case textsecure.protobuf.GroupContext.Type.DELIVER:
                    decrypted.group.name = null;
                    decrypted.group.members = [];
                    decrypted.group.avatar = null;

                    break;
                default:
                    throw new Error("Unknown group message type");
                }
            }
        }));
    }

    for (var i in decrypted.attachments) {
        promises.push(handleAttachment(decrypted.attachments[i]));
    }
    return Promise.all(promises).then(function() {
        return decrypted;
    });
}

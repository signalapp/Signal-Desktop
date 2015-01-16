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

window.textsecure = {
    utils: {
        jsonThing: function(thing) {
            return JSON.stringify(ensureStringed(thing));
        }
    }
};

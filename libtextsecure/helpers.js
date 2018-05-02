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
      return thing.toString('binary');
  }
  return thing;
}

function getStringable(thing) {
  return (
    typeof thing == 'string' ||
    typeof thing == 'number' ||
    typeof thing == 'boolean' ||
    (thing === Object(thing) &&
      (thing.__proto__ == StaticArrayBufferProto ||
        thing.__proto__ == StaticUint8ArrayProto ||
        thing.__proto__ == StaticByteBufferProto))
  );
}

// Number formatting utils
window.textsecure.utils = (function() {
  var self = {};
  self.unencodeNumber = function(number) {
    return number.split('.');
  };

  self.isNumberSane = function(number) {
    return number[0] == '+' && /^[0-9]+$/.test(number.substring(1));
  };

  /**************************
   *** JSON'ing Utilities ***
   **************************/
  function ensureStringed(thing) {
    if (getStringable(thing)) return getString(thing);
    else if (thing instanceof Array) {
      var res = [];
      for (var i = 0; i < thing.length; i++) res[i] = ensureStringed(thing[i]);
      return res;
    } else if (thing === Object(thing)) {
      var res = {};
      for (var key in thing) res[key] = ensureStringed(thing[key]);
      return res;
    } else if (thing === null) {
      return null;
    }
    throw new Error('unsure of how to jsonify object of type ' + typeof thing);
  }

  self.jsonThing = function(thing) {
    return JSON.stringify(ensureStringed(thing));
  };

  return self;
})();

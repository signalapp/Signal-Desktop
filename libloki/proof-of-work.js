const hash = require('js-sha512');
const bb = require('bytebuffer');

// Increment Uint8Array by 1 with carrying
function incrementNonce(nonce) {
  idx = nonce.length - 1;
  nonce[idx] += 1;
  // Nonce will just reset to 0 if all values are 255 causing infinite loop, should never happen
  while (nonce[idx] == 0 && idx >= 0) {
    nonce[--idx] += 1;
  }
  return nonce;
}

// Convert a Uint8Array to a base64 string. Copied from stackoverflow
function bufferToBase64(buf) {
  var binstr = Array.prototype.map.call(buf, function (ch) {
      return String.fromCharCode(ch);
  }).join('');
  return bb.btoa(binstr);
}

// Convert number to Uint8Array
function numberToUintArr(numberVal) {
  // TODO: Make this not hardcoded for arrays of length 8?
  var arr = new Uint8Array(8);
  for (var idx = 7; idx >= 0; idx--) {
    // Get the lowest 8 bits from the number
    var byte = numberVal & 0xff;
    arr[idx] = byte;
    // Essentially bitshift 
    numberVal = (numberVal - byte) / 256 ;
  }
  return arr;
}

// Return nonce that hashes together with payload lower than the target
function calcPoW(timestamp, ttl, pub_key, data) {
  var leadingString = timestamp.toString() + ttl.toString() + pub_key;
  var leadingArray = new Uint8Array(bb.wrap(leadingString, 'binary').toArrayBuffer());
  // Payload constructed from concatenating timestamp, ttl and pubkey strings, converting to Uint8Array
  // and then appending to the message data array
  var payload = leadingArray + data;
  var nonceLen = 8;
  // Modify this value for difficulty scaling
  // TODO: Have more informed reason for setting this to 100
  var nonceTrialsPerByte = 100;
  var nonce = new Uint8Array(nonceLen);
  var trialValue = numberToUintArr(Number.MAX_SAFE_INTEGER);
  // Target is converter to Uint8Array for simple comparison with trialValue
  var target = numberToUintArr(Math.pow(2, 64) / (
    nonceTrialsPerByte * (
      payload.length + nonceLen + (
        (ttl * ( payload.length + nonceLen ))
        / Math.pow(2, 16)
      )
    )
  ));
  initialHash = new Uint8Array(bb.wrap(hash(payload), 'hex').toArrayBuffer());
  while (target < trialValue) {
    nonce = incrementNonce(nonce);
    trialValue = (new Uint8Array(bb.wrap(hash(nonce + initialHash), 'hex').toArrayBuffer())).slice(0, 8);
  }
  return bufferToBase64(nonce);
}

// Start calculation in child process when main process sends message data
process.on('message', (msg) => {
	process.send({nonce: calcPoW(msg.timestamp, msg.ttl, msg.pub_key, msg.data)});
});
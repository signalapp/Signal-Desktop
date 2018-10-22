const hash = require('js-sha512');
const bb = require('bytebuffer');

// Increment Uint8Array nonce by 1 with carrying
function incrementNonce(nonce) {
  let idx = nonce.length - 1;
  nonce[idx] += 1;
  // Nonce will just reset to 0 if all values are 255 causing infinite loop, should never happen
  while (nonce[idx] == 0 && idx >= 0) {
    nonce[--idx] += 1;
  }
  return nonce;
}

// Convert a Uint8Array to a base64 string
function bufferToBase64(buf) {
  let binstr = Array.prototype.map.call(buf, function (ch) {
      return String.fromCharCode(ch);
  }).join('');
  return bb.btoa(binstr);
}

// Convert javascript number to Uint8Array of length 8
function numberToUintArr(numberVal) {
  let arr = new Uint8Array(8);
  for (let idx = 7; idx >= 0; idx--) {
    let n = 8 - (idx + 1);
    // 256 ** n is the value of one bit in arr[idx], modulus to carry over
    arr[idx] = (numberVal / 256**n) % 256;
  }
  return arr;
}

// Return nonce that hashes together with payload lower than the target
function calcPoW(timestamp, ttl, pub_key, data) {
  const leadingString = timestamp.toString() + ttl.toString() + pub_key;
  const leadingArray = new Uint8Array(bb.wrap(leadingString, 'binary').toArrayBuffer());
  // Payload constructed from concatenating timestamp, ttl and pubkey strings, converting to Uint8Array
  // and then appending to the message data array
  const payload = leadingArray + data;
  const nonceLen = 8;
  // Modify this value for difficulty scaling
  // TODO: Have more informed reason for setting this to 100
  const nonceTrialsPerByte = 1000;
  let nonce = new Uint8Array(nonceLen);
  let trialValue = numberToUintArr(Number.MAX_SAFE_INTEGER);
  // Target is converter to Uint8Array for simple comparison with trialValue
  const target = numberToUintArr(Math.floor(Math.pow(2, 64) / (
    nonceTrialsPerByte * (
      payload.length + nonceLen + (
        (ttl * ( payload.length + nonceLen ))
        / Math.pow(2, 16)
      )
    )
  )));
  const initialHash = new Uint8Array(bb.wrap(hash(payload), 'hex').toArrayBuffer());
  while (trialValue > target) {
    nonce = incrementNonce(nonce);
    trialValue = (new Uint8Array(bb.wrap(hash(nonce + initialHash), 'hex').toArrayBuffer())).slice(0, 8);
  }
  return bufferToBase64(nonce);
}

// Start calculation in child process when main process sends message data
process.on('message', (msg) => {
	process.send({nonce: calcPoW(msg.timestamp, msg.ttl, msg.pub_key, msg.data)});
});
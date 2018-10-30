const hash = require('js-sha512');
const bb = require('bytebuffer');

const NONCE_LEN = 8;

// Increment Uint8Array nonce by 1 with carrying
function incrementNonce(nonce) {
  let idx = NONCE_LEN - 1;
  const newNonce = nonce;
  newNonce[idx] += 1;
  // Nonce will just reset to 0 if all values are 255 causing infinite loop
  while (nonce[idx] === 0 && idx > 0) {
    idx -= 1;
    newNonce[idx] += 1;
  }
  return nonce;
}

// Convert a Uint8Array to a base64 string
function bufferToBase64(buf) {
  function mapFn(ch) {
      return String.fromCharCode(ch);
  };
  const binaryString = Array.prototype.map.call(buf, mapFn).join('');
  return bb.btoa(binaryString);
}

// Convert javascript number to Uint8Array of length 8
function numberToUintArr(numberVal) {
  const arr = new Uint8Array(NONCE_LEN);
  let n;
  for (let idx = NONCE_LEN - 1; idx >= 0; idx -= 1) {
    n = NONCE_LEN - (idx + 1);
    // 256 ** n is the value of one bit in arr[idx], modulus to carry over
    arr[idx] = (numberVal / 256**n) % 256;
  }
  return arr;
}

// Compare two Uint8Arrays, return true if arr1 is > arr2
function compareUint8Arrays(arr1, arr2) {
  // Early exit if lengths are not equal. Should never happen
  if (arr1.length !== arr2.length)
    return false;

  const len = arr1.length

  for (let i = 0; i < len; i += 1) {
    if (arr1[i] > arr2[i])
      return true;
    if (arr1[i] < arr2[i])
      return false;
  }
  return false;
}

// Return nonce that hashes together with payload lower than the target
function calcPoW(timestamp, ttl, pubKey, data) {
  const leadingString = timestamp.toString() + ttl.toString() + pubKey;
  const leadingArray = new Uint8Array(bb.wrap(leadingString, 'binary').toArrayBuffer());
  // Payload constructed from concatenating timestamp, ttl and pubkey strings,
  // converting to Uint8Array and then appending to the message data array
  const payload = new Uint8Array(leadingArray.length + data.length);
  payload.set(leadingArray);
  payload.set(data, leadingArray.length);
  // Modify this value for difficulty scaling
  const nonceTrialsPerByte = 1000;
  let nonce = new Uint8Array(NONCE_LEN);
  let trialValue = numberToUintArr(Number.MAX_SAFE_INTEGER);
  // Target is converted to Uint8Array for simple comparison with trialValue
  const targetNum = Math.floor(2**64 / (
    nonceTrialsPerByte * (
      payload.length + NONCE_LEN + (
        (ttl * ( payload.length + NONCE_LEN )) /
        2**16
      )
    )
  ));
  const target = numberToUintArr(targetNum);
  const initialHash = new Uint8Array(bb.wrap(hash(payload), 'hex').toArrayBuffer());
  const innerPayload = new Uint8Array(initialHash.length + NONCE_LEN);
  innerPayload.set(initialHash, NONCE_LEN);
  let resultHash;
  while (compareUint8Arrays(trialValue, target)) {
    nonce = incrementNonce(nonce);
    innerPayload.set(nonce);
    resultHash = hash(innerPayload);
    trialValue = (new Uint8Array(bb.wrap(resultHash, 'hex').toArrayBuffer())).slice(0, 8);
  }
  return bufferToBase64(nonce);
}

// Start calculation in child process when main process sends message data
process.on('message', (msg) => {
  // Convert data back to Uint8Array after IPC has serialised to JSON
  const msgLen = Object.keys(msg.data).length;
  const msgData = new Uint8Array(msgLen);
  for (let i = 0; i < msgLen; i += 1) {
    msgData[i] = msg.data[i];
  }
	process.send({nonce: calcPoW(msg.timestamp, msg.ttl, msg.pubKey, msgData)});
});

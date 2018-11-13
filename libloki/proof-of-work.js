const hash = require('js-sha512');
const bb = require('bytebuffer');
const BigInteger = require('jsbn').BigInteger;

const NONCE_LEN = 8;
// Modify this value for difficulty scaling
const NONCE_TRIALS = 1000;

// Increment Uint8Array nonce by 1 with carrying
function incrementNonce(nonce) {
  let idx = NONCE_LEN - 1;
  const newNonce = new Uint8Array(nonce);
  newNonce[idx] += 1;
  // Nonce will just reset to 0 if all values are 255 causing infinite loop
  while (newNonce[idx] === 0 && idx > 0) {
    idx -= 1;
    newNonce[idx] += 1;
  }
  return newNonce;
}

// Convert a Uint8Array to a base64 string
function bufferToBase64(buf) {
  function mapFn(ch) {
    return String.fromCharCode(ch);
  }
  const binaryString = Array.prototype.map.call(buf, mapFn).join('');
  return bb.btoa(binaryString);
}

// Convert BigInteger to Uint8Array of length NONCE_LEN
function bigIntToUint8Array(bigInt) {
  const arr = new Uint8Array(NONCE_LEN);
  let n;
  for (let idx = NONCE_LEN - 1; idx >= 0; idx -= 1) {
    n = NONCE_LEN - (idx + 1);
    // 256 ** n is the value of one bit in arr[idx], modulus to carry over
    // (bigInt / 256**n) % 256;
    const uint8Val = bigInt
      .divide(new BigInteger('256').pow(n))
      .mod(new BigInteger('256'));
    arr[idx] = uint8Val.intValue();
  }
  return arr;
}

// Compare two Uint8Arrays, return true if arr1 is > arr2
function greaterThan(arr1, arr2) {
  // Early exit if lengths are not equal. Should never happen
  if (arr1.length !== arr2.length) return false;

  for (let i = 0, len = arr1.length; i < len; i += 1) {
    if (arr1[i] > arr2[i]) return true;
    if (arr1[i] < arr2[i]) return false;
  }
  return false;
}

// Return nonce that hashes together with payload lower than the target
function calcPoW(timestamp, ttl, pubKey, data) {
  const payload = new Uint8Array(
    bb.wrap(timestamp.toString() + ttl.toString() + pubKey + data, 'binary').toArrayBuffer()
  );

  // payloadLength + NONCE_LEN
  const totalLen = new BigInteger(payload.length.toString()).add(
    new BigInteger(NONCE_LEN.toString())
  );
  // ttl * totalLen
  const ttlMult = new BigInteger(ttl.toString()).multiply(totalLen);
  // ttlMult / (2^16 - 1)
  const innerFrac = ttlMult.divide(
    new BigInteger('2').pow(16).subtract(new BigInteger('1'))
  );
  // totalLen + innerFrac
  const lenPlusInnerFrac = totalLen.add(innerFrac);
  // NONCE_TRIALS * lenPlusInnerFrac
  const denominator = new BigInteger(NONCE_TRIALS.toString()).multiply(
    lenPlusInnerFrac
  );
  // 2^64 - 1
  const two64 = new BigInteger('2').pow(64).subtract(new BigInteger('1'));
  // two64 / denominator
  const targetNum = two64.divide(denominator);
  const target = bigIntToUint8Array(targetNum);

  let nonce = new Uint8Array(NONCE_LEN);
  let trialValue = bigIntToUint8Array(
    new BigInteger(Number.MAX_SAFE_INTEGER.toString())
  );
  const initialHash = new Uint8Array(
    bb.wrap(hash(payload), 'hex').toArrayBuffer()
  );
  const innerPayload = new Uint8Array(initialHash.length + NONCE_LEN);
  innerPayload.set(initialHash, NONCE_LEN);
  let resultHash;
  while (greaterThan(trialValue, target)) {
    nonce = incrementNonce(nonce);
    innerPayload.set(nonce);
    resultHash = hash(innerPayload);
    trialValue = new Uint8Array(
      bb.wrap(resultHash, 'hex').toArrayBuffer()
    ).slice(0, NONCE_LEN);
  }
  return bufferToBase64(nonce);
}

// Start calculation in child process when main process sends message data
process.on('message', msg => {
  process.send({
    nonce: calcPoW(
      msg.timestamp,
      msg.ttl,
      msg.pubKey,
      msg.data
    ),
  });
});

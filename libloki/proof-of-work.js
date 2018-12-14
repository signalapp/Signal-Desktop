/* global dcodeIO, crypto, JSBI */
const NONCE_LEN = 8;
// Modify this value for difficulty scaling
const DEV_NONCE_TRIALS = 10;
const PROD_NONCE_TRIALS = 1000;

const pow = {
  // Increment Uint8Array nonce by 1 with carrying
  incrementNonce(nonce) {
    let idx = NONCE_LEN - 1;
    const newNonce = new Uint8Array(nonce);
    newNonce[idx] += 1;
    // Nonce will just reset to 0 if all values are 255 causing infinite loop
    while (newNonce[idx] === 0 && idx > 0) {
      idx -= 1;
      newNonce[idx] += 1;
    }
    return newNonce;
  },

  // Convert a Uint8Array to a base64 string
  bufferToBase64(buf) {
    function mapFn(ch) {
      return String.fromCharCode(ch);
    }
    const binaryString = Array.prototype.map.call(buf, mapFn).join('');
    return dcodeIO.ByteBuffer.btoa(binaryString);
  },

  // Convert BigInteger to Uint8Array of length NONCE_LEN
  bigIntToUint8Array(bigInt) {
    const arr = new Uint8Array(NONCE_LEN);
    let n;
    for (let idx = NONCE_LEN - 1; idx >= 0; idx -= 1) {
      n = NONCE_LEN - (idx + 1);
      // 256 ** n is the value of one bit in arr[idx], modulus to carry over
      // (bigInt / 256**n) % 256;
      const denominator = JSBI.exponentiate(
        JSBI.BigInt('256'),
        JSBI.BigInt(n)
      );
      const fraction = JSBI.divide(bigInt, denominator);
      const uint8Val = JSBI.remainder(fraction, JSBI.BigInt(256));
      arr[idx] = JSBI.toNumber(uint8Val);
    }
    return arr;
  },

  // Compare two Uint8Arrays, return true if arr1 is > arr2
  greaterThan(arr1, arr2) {
    // Early exit if lengths are not equal. Should never happen
    if (arr1.length !== arr2.length) return false;

    for (let i = 0, len = arr1.length; i < len; i += 1) {
      if (arr1[i] > arr2[i]) return true;
      if (arr1[i] < arr2[i]) return false;
    }
    return false;
  },

  // Return nonce that hashes together with payload lower than the target
  async calcPoW(timestamp, ttl, pubKey, data, development = false) {
    const payload = new Uint8Array(
      dcodeIO.ByteBuffer.wrap(
        timestamp.toString() + ttl.toString() + pubKey + data,
        'binary'
      ).toArrayBuffer()
    );

    const nonceTrials = development ? DEV_NONCE_TRIALS : PROD_NONCE_TRIALS;
    const target = pow.calcTarget(ttl, payload.length, nonceTrials);

    let nonce = new Uint8Array(NONCE_LEN);
    let trialValue = pow.bigIntToUint8Array(
      JSBI.BigInt(Number.MAX_SAFE_INTEGER)
    );
    const initialHash = new Uint8Array(
      await crypto.subtle.digest('SHA-512', payload)
    );
    const innerPayload = new Uint8Array(initialHash.length + NONCE_LEN);
    innerPayload.set(initialHash, NONCE_LEN);
    let resultHash;
    while (pow.greaterThan(trialValue, target)) {
      nonce = pow.incrementNonce(nonce);
      innerPayload.set(nonce);
      // eslint-disable-next-line no-await-in-loop
      resultHash = await crypto.subtle.digest('SHA-512', innerPayload);
      trialValue = new Uint8Array(
        dcodeIO.ByteBuffer.wrap(resultHash, 'hex').toArrayBuffer()
      ).slice(0, NONCE_LEN);
    }
    return pow.bufferToBase64(nonce);
  },

  calcTarget(ttl, payloadLen, nonceTrials = PROD_NONCE_TRIALS) {
    // payloadLength + NONCE_LEN
    const totalLen = JSBI.add(
      JSBI.BigInt(payloadLen),
      JSBI.BigInt(NONCE_LEN)
    );
    // ttl * totalLen
    const ttlMult = JSBI.multiply(
      JSBI.BigInt(ttl),
      JSBI.BigInt(totalLen)
    );
    // 2^16 - 1
    const two16 = JSBI.subtract(
      JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(16)), // 2^16
      JSBI.BigInt(1)
    );
    // ttlMult / two16
    const innerFrac = JSBI.divide(
      ttlMult,
      two16
    );
    // totalLen + innerFrac
    const lenPlusInnerFrac = JSBI.add(totalLen, innerFrac);
    // nonceTrials * lenPlusInnerFrac
    const denominator = JSBI.multiply(
      JSBI.BigInt(nonceTrials),
      lenPlusInnerFrac
    );
    // 2^64 - 1
    const two64 = JSBI.subtract(
      JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(64)), // 2^64
      JSBI.BigInt(1)
    );
    // two64 / denominator
    const targetNum = JSBI.divide(two64, denominator);
    return pow.bigIntToUint8Array(targetNum);
  },
};

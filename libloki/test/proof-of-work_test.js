/* global assert, JSBI, pow */

const {
  calcTarget,
  incrementNonce,
  bufferToBase64,
  bigIntToUint8Array,
  greaterThan,
} = pow;

describe('Proof of Work Worker', () => {
  it('should increment a Uint8Array nonce correctly', () => {
    const arr1Before = new Uint8Array([0,0,0,0,0,0,0,0]);
    const arr1After = incrementNonce(arr1Before);
    assert.strictEqual(arr1After[0], 0);
    assert.strictEqual(arr1After[1], 0);
    assert.strictEqual(arr1After[2], 0);
    assert.strictEqual(arr1After[3], 0);
    assert.strictEqual(arr1After[4], 0);
    assert.strictEqual(arr1After[5], 0);
    assert.strictEqual(arr1After[6], 0);
    assert.strictEqual(arr1After[7], 1);
  });

  it('should increment a Uint8Array nonce correctly', () => {
    let arr = new Uint8Array([0,0,0,0,0,0,0,0]);
    assert.deepEqual(incrementNonce(arr), new Uint8Array([0,0,0,0,0,0,0,1]));
    arr = new Uint8Array([0,0,0,0,0,0,0,0]);
    for(let i = 0; i <= 255; i += 1) {
      arr = incrementNonce(arr);
    }
    assert.deepEqual(arr, new Uint8Array([0,0,0,0,0,0,1,0]));
    arr = new Uint8Array([255,255,255,255,255,255,255,255]);
    assert.deepEqual(incrementNonce(arr), new Uint8Array([0,0,0,0,0,0,0,0]));
  });

  it('should calculate a correct difficulty target', () => {
    // These values will need to be updated if we adjust the difficulty settings
    let payloadLen = 625;
    const ttl = 86400;
    let expectedTarget = new Uint8Array([0,4,119,164,35,224,222,64]);

    let actualTarget = calcTarget(ttl, payloadLen, 10);
    assert.deepEqual(actualTarget, expectedTarget);
    payloadLen = 6597;
    expectedTarget = new Uint8Array([0,0,109,145,174,146,124,3]);
    actualTarget = calcTarget(ttl, payloadLen, 10);
    assert.deepEqual(actualTarget, expectedTarget);
  });

  it('should correclty compare two Uint8Arrays', () => {
    let arr1 = new Uint8Array([0,0,0,0,0,0,0,0,0,1]);
    let arr2 = new Uint8Array([0,0,0,0,0,0,0,0,0,1]);
    assert.isFalse(greaterThan(arr1, arr2))
    arr1 = new Uint8Array([0,0,0,0,0,0,0,0,0,2]);
    arr2 = new Uint8Array([0,0,0,0,0,0,0,0,0,1]);
    assert.isTrue(greaterThan(arr1, arr2))
    arr1 = new Uint8Array([255,255,255,255,255,255,255,255,255,255]);
    arr2 = new Uint8Array([255,255,255,255,255,255,255,255,255,254]);
    assert.isTrue(greaterThan(arr1, arr2))
    arr1 = new Uint8Array([254,255,255,255,255,255,255,255,255,255]);
    arr2 = new Uint8Array([255,255,255,255,255,255,255,255,255,255]);
    assert.isFalse(greaterThan(arr1, arr2));
    arr1 = new Uint8Array([0]);
    arr2 = new Uint8Array([0,0]);
    assert.isFalse(greaterThan(arr1, arr2))
  });

  it('should correclty convert a Uint8Array to a base64 string', () => {
    let arr = new Uint8Array([1,2,3]);
    let expected = 'AQID';
    assert.strictEqual(bufferToBase64(arr), expected);
    arr = new Uint8Array([123,25,3,121,45,87,24,111]);
    expected = 'exkDeS1XGG8=';
    assert.strictEqual(bufferToBase64(arr), expected);
    arr = new Uint8Array([]);
    expected = '';
    assert.strictEqual(bufferToBase64(arr), expected);
  });

  it('should correclty convert a BigInteger to a Uint8Array', () => {
    let bigInt = JSBI.BigInt(Number.MAX_SAFE_INTEGER);
    let expected = new Uint8Array([0, 31, 255, 255, 255, 255, 255, 255]);
    assert.deepEqual(bigIntToUint8Array(bigInt), expected);
    bigInt = JSBI.BigInt('0');
    expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(bigIntToUint8Array(bigInt), expected);
    bigInt = JSBI.BigInt('255');
    expected = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255]);
    assert.deepEqual(bigIntToUint8Array(bigInt), expected);
    bigInt = JSBI.BigInt('256');
    expected = new Uint8Array([0, 0, 0, 0, 0, 0, 1, 0]);
    assert.deepEqual(bigIntToUint8Array(bigInt), expected);
  });
});

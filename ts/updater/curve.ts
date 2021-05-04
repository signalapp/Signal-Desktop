import { randomBytes } from 'crypto';

const g = global as any;

// Because curve wrapper will populate this
g.Internal = {};

// Because curve wrapper uses 'Module' to get at curve-provided functionality
// tslint:disable-next-line
g.Module = require('../../js/curve/curve25519_compiled');
// tslint:disable-next-line
require('../../js/curve/curve25519_wrapper');

export type BinaryType = Uint8Array | Buffer;

interface CurveType {
  keyPair: (
    privateKey: BinaryType
  ) => {
    pubKey: BinaryType;
    privKey: BinaryType;
  };
  sign: (privateKey: BinaryType, message: BinaryType) => BinaryType;
  verify: (publicKey: BinaryType, message: BinaryType, signature: BinaryType) => boolean;
}

const { keyPair: internalKeyPair, sign: internalSign, verify: internalVerify } = g.Internal
  .curve25519 as CurveType;

export function keyPair() {
  const privateKey = randomBytes(32);
  const { pubKey, privKey } = internalKeyPair(privateKey);

  return {
    publicKey: pubKey,
    privateKey: privKey,
  };
}

export function sign(privateKey: BinaryType, message: BinaryType) {
  return internalSign(privateKey, message);
}

export function verify(publicKey: BinaryType, message: BinaryType, signature: BinaryType) {
  const failed = internalVerify(publicKey, message, signature);

  return !failed;
}

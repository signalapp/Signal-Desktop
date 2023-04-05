import { from_hex } from 'libsodium-wrappers-sumo';
import { concatUInt8Array, LibSodiumWrappers } from '../crypto';

export function generateBlindingFactor(serverPk: string, sodium: LibSodiumWrappers) {
  const hexServerPk = from_hex(serverPk);
  const serverPkHash = sodium.crypto_generichash(64, hexServerPk);
  if (!serverPkHash.length) {
    throw new Error('generateBlindingFactor: crypto_generichash failed');
  }

  // Reduce the server public key into an ed25519 scalar (`k`)
  const k = sodium.crypto_core_ed25519_scalar_reduce(serverPkHash);

  return k;
}

export function combineKeys(
  lhsKeyBytes: Uint8Array,
  rhsKeyBytes: Uint8Array,
  sodium: LibSodiumWrappers
) {
  return sodium.crypto_scalarmult_ed25519_noclamp(lhsKeyBytes, rhsKeyBytes);
}

// Calculate a shared secret for a message from A to B:
//
// BLAKE2b(a kB || kA || kB)
//
// The receiver can calculate the same value via:
//
// BLAKE2b(b kA || kA || kB)
export function sharedBlindedEncryptionKey({
  fromBlindedPublicKey,
  otherBlindedPublicKey,
  secretKey,
  sodium,
  toBlindedPublicKey,
}: {
  secretKey: Uint8Array;
  otherBlindedPublicKey: Uint8Array;
  fromBlindedPublicKey: Uint8Array;
  toBlindedPublicKey: Uint8Array;
  sodium: LibSodiumWrappers;
}) {
  const aBytes = generatePrivateKeyScalar(secretKey, sodium);
  const combinedKeyBytes = combineKeys(aBytes, otherBlindedPublicKey, sodium);
  return sodium.crypto_generichash(
    32,
    concatUInt8Array(combinedKeyBytes, fromBlindedPublicKey, toBlindedPublicKey)
  );
}

// Calculate k*a.  To get 'a' (the Ed25519 private key scalar) we call the sodium function to
// convert to an *x* secret key, which seems wrong--but isn't because converted keys use the
// same secret scalar secret (and so this is just the most convenient way to get 'a' out of
// a sodium Ed25519 secret key)
export function generatePrivateKeyScalar(secretKey: Uint8Array, sodium: LibSodiumWrappers) {
  return sodium.crypto_sign_ed25519_sk_to_curve25519(secretKey);
}

export function toX25519(ed25519PublicKey: Uint8Array, sodium: LibSodiumWrappers) {
  return sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519PublicKey);
}

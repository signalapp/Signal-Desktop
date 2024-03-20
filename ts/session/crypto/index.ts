import crypto from 'crypto';
import libsodiumwrappers from 'libsodium-wrappers-sumo';

import * as DecryptedAttachmentsManager from './DecryptedAttachmentsManager';
import * as MessageEncrypter from './MessageEncrypter';

import { ECKeyPair } from '../../receiver/keypairs';
import { toHex } from '../utils/String';

export { DecryptedAttachmentsManager, MessageEncrypter };

export type LibSodiumWrappers = typeof libsodiumwrappers;

export async function getSodiumRenderer(): Promise<LibSodiumWrappers> {
  await libsodiumwrappers.ready;
  return libsodiumwrappers;
}

export const sha256 = (s: string) => {
  return crypto.createHash('sha256').update(s).digest('base64');
};

export const concatUInt8Array = (...args: Array<Uint8Array>): Uint8Array => {
  const totalLength = args.reduce((acc, current) => acc + current.length, 0);

  const concatted = new Uint8Array(totalLength);
  let currentIndex = 0;
  args.forEach(arr => {
    concatted.set(arr, currentIndex);
    currentIndex += arr.length;
  });

  return concatted;
};

/**
 * Returns a generated curve25519 hex public key being of length 66 and starting with 05.
 * For a closed group, we have one publicKey (with prefix) used for polling (this function),
 * and one keypair without prefix used for encoding of the messages (function generateCurve25519KeyPairWithoutPrefix).
 */
export async function generateClosedGroupPublicKey() {
  const sodium = await getSodiumRenderer();

  const ed25519KeyPair = sodium.crypto_sign_keypair();
  const x25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519KeyPair.publicKey);
  // prepend version byte (coming from `processKeys(raw_keys)`)
  const origPub = new Uint8Array(x25519PublicKey);
  const prependedX25519PublicKey = new Uint8Array(33);
  prependedX25519PublicKey.set(origPub, 1);
  prependedX25519PublicKey[0] = 5;

  return toHex(prependedX25519PublicKey);
}

/**
 * Returns a generated ed25519 hex with a public key being of length 66 and starting with 03.
 */
export async function generateGroupV3Keypair() {
  const sodium = await getSodiumRenderer();
  const ed25519KeyPair = sodium.crypto_sign_keypair();

  const publicKey = new Uint8Array(ed25519KeyPair.publicKey);
  const preprendedPubkey = new Uint8Array(33);
  preprendedPubkey.set(publicKey, 1);
  preprendedPubkey[0] = 3;

  return { pubkey: toHex(preprendedPubkey), privateKey: toHex(ed25519KeyPair.privateKey) };
}

/**
 * Returns a generated curve25519 keypair without the prefix on the public key.
 * This should be used for the generation of encryption keypairs for a closed group
 */
export async function generateCurve25519KeyPairWithoutPrefix(): Promise<ECKeyPair | null> {
  const sodium = await getSodiumRenderer();

  try {
    const ed25519KeyPair = sodium.crypto_sign_keypair();
    const x25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed25519KeyPair.publicKey);
    const x25519SecretKey = sodium.crypto_sign_ed25519_sk_to_curve25519(ed25519KeyPair.privateKey);

    return new ECKeyPair(x25519PublicKey, x25519SecretKey);
  } catch (err) {
    return null;
  }
}

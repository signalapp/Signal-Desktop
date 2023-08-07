import { crypto_hash_sha512, from_hex, to_hex } from 'libsodium-wrappers-sumo';
import { isEqual } from 'lodash';

import { encode, fromUInt8ArrayToBase64, stringToUint8Array, toHex } from '../../../utils/String';
import { concatUInt8Array, getSodiumRenderer, LibSodiumWrappers } from '../../../crypto';

import { ByteKeyPair } from '../../../utils/User';
import { StringUtils } from '../../../utils';
import { KeyPrefixType, PubKey } from '../../../types';
import { OpenGroupRequestHeaders } from '../opengroupV2/OpenGroupPollingUtils';
import {
  combineKeys,
  generateBlindingFactor,
  sharedBlindedEncryptionKey,
  toX25519,
} from '../../../utils/SodiumUtils';
import { OnionSending } from '../../../onions/onionSend';

async function getSogsSignature({
  blinded,
  ka,
  kA,
  toSign,
  signingKeys,
}: {
  blinded: boolean;
  ka?: Uint8Array;
  kA?: Uint8Array;
  toSign: Uint8Array;
  signingKeys: ByteKeyPair;
}) {
  const sodium = await getSodiumRenderer();

  if (blinded && ka && kA) {
    return blindedED25519Signature(toSign, signingKeys, ka, kA);
  }
  return sodium.crypto_sign_detached(toSign, signingKeys.privKeyBytes);
}

async function getOpenGroupHeaders(data: {
  /**
   * Our ED25519 Key pair
   */
  signingKeys: ByteKeyPair;
  /**
   * The server public key - before blinding
   */
  serverPK: Uint8Array;
  nonce: Uint8Array;
  method: string;
  path: string;
  /** Note: on server side both text and number timestamps are accepted */
  timestamp: number;
  /** Apply blinding modifications or not */
  blinded: boolean;
  body: string | null | Uint8Array;
}): Promise<OpenGroupRequestHeaders> {
  const { signingKeys, serverPK, nonce, method, path, timestamp, blinded, body } = data;
  const sodium = await getSodiumRenderer();
  let pubkey;

  let ka;
  let kA;
  if (blinded) {
    const blindingValues = getBlindingValues(serverPK, signingKeys, sodium);
    ka = blindingValues.secretKey;
    kA = blindingValues.publicKey;
    // TODO we will need to add the support of blinded25 here
    pubkey = `${KeyPrefixType.blinded15}${toHex(kA)}`;
  } else {
    pubkey = `${KeyPrefixType.unblinded}${toHex(signingKeys.pubKeyBytes)}`;
  }

  const rawPath = OnionSending.endpointRequiresDecoding(path); // this gets a string of the path wioth potentially emojis in it
  const encodedPath = new Uint8Array(encode(rawPath, 'utf8')); // this gets the binary content of that utf8 string

  // SERVER_PUBKEY || NONCE || TIMESTAMP || METHOD || PATH || HASHED_BODY
  let toSign = concatUInt8Array(
    serverPK,
    nonce,
    stringToUint8Array(timestamp.toString()),
    stringToUint8Array(method),
    encodedPath
  );

  if (body) {
    const bodyHashed = sodium.crypto_generichash(64, body);

    toSign = concatUInt8Array(toSign, bodyHashed);
  }

  const signature = await SogsBlinding.getSogsSignature({ blinded, kA, ka, signingKeys, toSign });

  const headers: OpenGroupRequestHeaders = {
    'X-SOGS-Pubkey': pubkey,
    'X-SOGS-Timestamp': `${timestamp}`,
    'X-SOGS-Nonce': fromUInt8ArrayToBase64(nonce),
    'X-SOGS-Signature': fromUInt8ArrayToBase64(signature),
  };

  return headers;
}

/**
 *
 * @param messageParts concatenated byte array
 * @param ourKeyPair our devices keypair
 * @param ka blinded secret key for this open group
 * @param kA blinded pubkey for this open group
 * @returns blinded signature
 */
async function blindedED25519Signature(
  messageParts: Uint8Array,
  ourKeyPair: ByteKeyPair,
  ka: Uint8Array,
  kA: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodiumRenderer();

  const sEncode = ourKeyPair.privKeyBytes.slice(0, 32);

  const shaFullLength = sodium.crypto_hash_sha512(sEncode);

  const Hrh = shaFullLength.slice(32);

  const r = sodium.crypto_core_ed25519_scalar_reduce(sha512Multipart([Hrh, kA, messageParts]));

  const sigR = sodium.crypto_scalarmult_ed25519_base_noclamp(r);

  const HRAM = sodium.crypto_core_ed25519_scalar_reduce(sha512Multipart([sigR, kA, messageParts]));

  const sigS = sodium.crypto_core_ed25519_scalar_add(
    r,
    sodium.crypto_core_ed25519_scalar_mul(HRAM, ka)
  );

  const fullSig = concatUInt8Array(sigR, sigS);
  return fullSig;
}

const sha512Multipart = (parts: Array<Uint8Array>) => {
  return crypto_hash_sha512(concatUInt8Array(...parts));
};

/**
 * Creates a blinded pubkey for specific use with a certain open group
 * @param serverPK The server we're blinding against
 * @param signingKeys The signing keys (ED25519)
 * @returns Prefixed blinded pubkey for the open group
 */
const getBlindedPubKey = (
  serverPK: Uint8Array,
  signingKeys: ByteKeyPair,
  sodium: LibSodiumWrappers
): string => {
  const blindedPubKeyBytes = getBlindingValues(serverPK, signingKeys, sodium);
  // TODO we will need to add the support of blinded25 here
  return `${KeyPrefixType.blinded15}${to_hex(blindedPubKeyBytes.publicKey)}`;
};

const getBlindingValues = (
  serverPK: Uint8Array,
  signingKeys: ByteKeyPair,
  sodium: LibSodiumWrappers
): {
  a: Uint8Array;
  secretKey: Uint8Array;
  publicKey: Uint8Array;
} => {
  const k = sodium.crypto_core_ed25519_scalar_reduce(sodium.crypto_generichash(64, serverPK));

  // use curve key i.e. s.privKey
  let a = sodium.crypto_sign_ed25519_sk_to_curve25519(signingKeys.privKeyBytes); // this is the equivalent of ios generatePrivateKeyScalar

  if (a.length > 32) {
    window.log.warn('length of signing key is too long, cutting to 32: oldlength', a.length);
    a = a.slice(0, 32);
  }

  // our blinded keypair
  const ka = sodium.crypto_core_ed25519_scalar_mul(k, a); // had to cast for some reason

  const kA = sodium.crypto_scalarmult_ed25519_base_noclamp(ka);

  return {
    a,
    secretKey: ka,
    publicKey: kA,
  };
};

/**
 * Used for encrypting a blinded message (request) to a SOGS user.
 * @param body body of the message being encrypted
 * @param serverPK the server public key being sent to. Cannot be b64 encoded. Use fromHex and be sure to exclude the blinded 00/15/05 prefixes
 */
const encryptBlindedMessage = async (options: {
  rawData: Uint8Array;
  senderSigningKey: ByteKeyPair;
  /** Pubkey that corresponds to the recipients blinded PubKey */
  serverPubKey: Uint8Array;
  recipientSigningKey?: ByteKeyPair;
  recipientBlindedPublicKey?: Uint8Array;
}): Promise<Uint8Array | null> => {
  const {
    rawData,
    senderSigningKey,
    serverPubKey,
    recipientSigningKey,
    recipientBlindedPublicKey,
  } = options;
  const sodium = await getSodiumRenderer();

  const aBlindingValues = SogsBlinding.getBlindingValues(serverPubKey, senderSigningKey, sodium);

  let kB;
  if (!recipientBlindedPublicKey && recipientSigningKey) {
    const bBlindingValues = SogsBlinding.getBlindingValues(
      serverPubKey,
      recipientSigningKey,
      sodium
    );
    kB = bBlindingValues.publicKey;
  }
  if (recipientBlindedPublicKey) {
    kB = recipientBlindedPublicKey;
  }

  if (!kB) {
    window?.log?.error('No recipient-side data provided for encryption');
    return null;
  }

  const { a, publicKey: kA } = aBlindingValues;

  const encryptKey = sodium.crypto_generichash(
    32,
    concatUInt8Array(sodium.crypto_scalarmult_ed25519_noclamp(a, kB), kA, kB)
  );

  // inner data: msg || A (i.e. the sender's ed25519 master pubkey, *not* the kA blinded pubkey)
  const plaintext = concatUInt8Array(rawData, senderSigningKey.pubKeyBytes);

  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    encryptKey
  );

  // add our "version" info which will be checked by the recipient side
  const prefixData = new Uint8Array(StringUtils.encode('\x00', 'utf8'));
  const data = concatUInt8Array(prefixData, ciphertext, nonce);
  return data;
};

async function decryptWithSessionBlindingProtocol(
  data: Uint8Array,
  isOutgoing: boolean,
  otherBlindedPublicKey: string,
  serverPubkey: string,
  userEd25519KeyPair: ByteKeyPair
) {
  const sodium = await getSodiumRenderer();
  if (data.length <= sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES) {
    throw new Error(
      `data is too short. should be at least ${sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES} but is ${data.length}`
    );
  }

  const blindedKeyPair = SogsBlinding.getBlindingValues(
    from_hex(serverPubkey),
    userEd25519KeyPair,
    sodium
  );
  if (!blindedKeyPair) {
    throw new Error('Decryption failed');
  }
  /// Step one: calculate the shared encryption key, receiving from A to B
  const otherKeyBytes = from_hex(PubKey.removePrefixIfNeeded(otherBlindedPublicKey));
  const kA = isOutgoing ? blindedKeyPair.publicKey : otherKeyBytes;
  const decKey = sharedBlindedEncryptionKey({
    secretKey: userEd25519KeyPair.privKeyBytes,
    otherBlindedPublicKey: otherKeyBytes,
    fromBlindedPublicKey: kA,
    toBlindedPublicKey: isOutgoing ? otherKeyBytes : blindedKeyPair.publicKey,
    sodium,
  });
  if (!decKey) {
    throw new Error('Decryption failed');
  }

  // v, ct, nc = data[0], data[1:-24], data[-24:]
  const version = data[0];
  const ciphertext = data.slice(
    1,
    data.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  );
  const nonce = data.slice(data.length - sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

  // Make sure our encryption version is okay

  if (version !== 0) {
    throw new Error('Decryption failed');
  }

  // Decrypt
  const innerBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonce,
    decKey
  );
  if (!innerBytes) {
    throw new Error('Decryption failed');
  }
  const numBytesPubkey = PubKey.PUBKEY_LEN_NO_PREFIX / 2;
  // Ensure the length is correct
  if (innerBytes.length <= numBytesPubkey) {
    throw new Error('Decryption failed');
  }

  // Split up: the last 32 bytes are the sender's *unblinded* ed25519 key
  const plainText = innerBytes.slice(0, innerBytes.length - numBytesPubkey);
  const senderEdpk = innerBytes.slice(innerBytes.length - numBytesPubkey);

  // Verify that the inner sender_edpk (A) yields the same outer kA we got with the message
  const blindingFactor = generateBlindingFactor(serverPubkey, sodium);
  const sharedSecret = combineKeys(blindingFactor, senderEdpk, sodium);

  if (!isEqual(kA, sharedSecret)) {
    throw new Error('Invalid Signature');
  }
  // Get the sender's X25519 public key
  const senderSessionIdBytes = toX25519(senderEdpk, sodium);

  return { plainText, senderUnblinded: `${KeyPrefixType.standard}${to_hex(senderSessionIdBytes)}` };
}

export const SogsBlinding = {
  getSogsSignature,
  getOpenGroupHeaders,
  sha512Multipart,
  getBlindedPubKey,
  getBlindingValues,
  encryptBlindedMessage,
  decryptWithSessionBlindingProtocol,
};

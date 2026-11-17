// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// oxlint-disable max-classes-per-file

import { PublicKey, Aci, Pni } from '@signalapp/libsignal-client';

import type { Bytes } from '@signalapp/types';

import type { KeyPairType } from './Types.d.ts';
import {
  decryptAes256CbcPkcsPadding,
  deriveSecrets,
  encryptAes256CbcPkcsPadding,
  getRandomBytes,
  hmacSha256,
  verifyHmacSha256,
} from '../Crypto.node.ts';
import {
  calculateAgreement,
  createKeyPair,
  generateKeyPair,
} from '../Curve.node.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { dropNull } from '../util/dropNull.std.ts';
import { normalizeAci } from '../util/normalizeAci.std.ts';
import {
  type AciString,
  type PniString,
  normalizePni,
  toTaggedPni,
  isUntaggedPniString,
  fromAciObject,
  fromPniObject,
} from '../types/ServiceId.std.ts';
import { concatenate, fromString, isNotEmpty } from '../Bytes.std.ts';

const PROVISIONING_STRING = 'TextSecure Provisioning Message';
const MAC_LENGTH = 32;
export const IV_LENGTH = 16;
export const VERSION_BYTE = 1;

export type ProvisionDecryptResult = Readonly<{
  aciKeyPair: KeyPairType;
  pniKeyPair?: KeyPairType;
  number?: string;
  aci: AciString;
  pni?: PniString;
  provisioningCode?: string;
  userAgent?: string;
  readReceipts?: boolean;
  profileKey?: Uint8Array<ArrayBuffer>;
  masterKey?: Uint8Array<ArrayBuffer>;
  accountEntropyPool: string | undefined;
  mediaRootBackupKey: Uint8Array<ArrayBuffer> | undefined;
  ephemeralBackupKey: Uint8Array<ArrayBuffer> | undefined;
  authCredentialSalt: Uint8Array<ArrayBuffer> | undefined;
}>;

class ProvisioningCipherInner {
  keyPair?: KeyPairType;

  decrypt(provisionEnvelope: Proto.ProvisionEnvelope): ProvisionDecryptResult {
    strictAssert(
      provisionEnvelope.publicKey,
      'Missing publicKey in ProvisionEnvelope'
    );
    strictAssert(provisionEnvelope.body, 'Missing body in ProvisionEnvelope');
    const message = provisionEnvelope.body;
    if (new Uint8Array(message)[0] !== 1) {
      throw new Error('Bad version number on ProvisioningMessage');
    }

    const iv = message.subarray(1, IV_LENGTH + 1);
    const mac = message.subarray(
      message.byteLength - MAC_LENGTH,
      message.byteLength
    );
    const ivAndCiphertext = message.subarray(
      0,
      message.byteLength - MAC_LENGTH
    );
    const ciphertext = message.subarray(
      IV_LENGTH + 1,
      message.byteLength - MAC_LENGTH
    );

    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.decrypt: No keypair!');
    }

    const ourPrivateKey = this.keyPair.privateKey;
    const theirPublicKey = PublicKey.deserialize(provisionEnvelope.publicKey);
    const { cipherKey, macKey } = deriveKeys(theirPublicKey, ourPrivateKey);

    verifyHmacSha256(ivAndCiphertext, macKey, mac, MAC_LENGTH);

    const plaintext = decryptAes256CbcPkcsPadding(cipherKey, ciphertext, iv);
    const provisionMessage = Proto.ProvisionMessage.decode(plaintext);
    const aciPrivKey = provisionMessage.aciIdentityKeyPrivate;
    const pniPrivKey = provisionMessage.pniIdentityKeyPrivate;
    strictAssert(aciPrivKey, 'Missing aciKeyPrivate in ProvisionMessage');

    const aciKeyPair = createKeyPair(aciPrivKey);
    const pniKeyPair = pniPrivKey?.length
      ? createKeyPair(pniPrivKey)
      : undefined;

    const {
      aci: rawAci,
      pni: rawUntaggedPni,
      aciBinary,
      pniBinary,
    } = provisionMessage;

    let aci: AciString;
    if (isNotEmpty(aciBinary)) {
      aci = fromAciObject(Aci.fromUuidBytes(aciBinary));
    } else if (rawAci) {
      aci = normalizeAci(rawAci, 'provisionMessage.aci');
    } else {
      throw new Error('Missing aci in provisioning message');
    }

    let pni: PniString | undefined;
    if (isNotEmpty(pniBinary)) {
      pni = fromPniObject(Pni.fromUuidBytes(pniBinary));
    } else if (rawUntaggedPni) {
      strictAssert(
        isUntaggedPniString(rawUntaggedPni),
        'ProvisioningCipher: invalid untaggedPni'
      );

      pni = normalizePni(toTaggedPni(rawUntaggedPni), 'provisionMessage.pni');
    }

    if (pni == null) {
      strictAssert(pniKeyPair == null, 'pni keypair without pni');
    } else {
      strictAssert(pniKeyPair != null, 'pni without pni keypair');
    }

    return {
      aciKeyPair,
      pniKeyPair,
      number: dropNull(provisionMessage.number),
      aci,
      pni,
      provisioningCode: dropNull(provisionMessage.provisioningCode),
      userAgent: dropNull(provisionMessage.userAgent),
      readReceipts: provisionMessage.readReceipts ?? false,
      profileKey: isNotEmpty(provisionMessage.profileKey)
        ? provisionMessage.profileKey
        : undefined,
      masterKey: isNotEmpty(provisionMessage.masterKey)
        ? provisionMessage.masterKey
        : undefined,
      ephemeralBackupKey: isNotEmpty(provisionMessage.ephemeralBackupKey)
        ? provisionMessage.ephemeralBackupKey
        : undefined,
      authCredentialSalt: isNotEmpty(provisionMessage.authCredentialSalt)
        ? provisionMessage.authCredentialSalt
        : undefined,
      mediaRootBackupKey: isNotEmpty(provisionMessage.mediaRootBackupKey)
        ? provisionMessage.mediaRootBackupKey
        : undefined,
      accountEntropyPool: provisionMessage.accountEntropyPool || undefined,
    };
  }

  encrypt(message: Proto.ProvisionMessage, theirPublicKey: PublicKey): Bytes {
    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.encrypt: No keypair!');
    }

    const iv = getRandomBytes(IV_LENGTH);
    const plaintext = Proto.ProvisionMessage.encode(message);

    const ourPrivateKey = this.keyPair.privateKey;
    const { cipherKey, macKey } = deriveKeys(theirPublicKey, ourPrivateKey);

    const versionByte = new Uint8Array([VERSION_BYTE]);
    const ciphertext = encryptAes256CbcPkcsPadding(cipherKey, plaintext, iv);
    const ivAndCiphertext = concatenate([versionByte, iv, ciphertext]);
    const mac = hmacSha256(macKey, ivAndCiphertext);
    strictAssert(
      mac.byteLength === MAC_LENGTH,
      `Mac was ${mac.byteLength} bytes instead of ${MAC_LENGTH}!`
    );

    return concatenate([versionByte, iv, ciphertext, mac]);
  }

  getPublicKey(): PublicKey {
    if (!this.keyPair) {
      this.keyPair = generateKeyPair();
    }

    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.decrypt: No keypair!');
    }

    return this.keyPair.publicKey;
  }
}

export default class ProvisioningCipher {
  constructor() {
    const inner = new ProvisioningCipherInner();

    this.decrypt = inner.decrypt.bind(inner);
    this.encrypt = inner.encrypt.bind(inner);
    this.getPublicKey = inner.getPublicKey.bind(inner);
  }

  decrypt: (
    provisionEnvelope: Proto.ProvisionEnvelope
  ) => ProvisionDecryptResult;
  encrypt: (
    provisionMessage: Proto.ProvisionMessage,
    theirPublicKey: PublicKey
  ) => Bytes;

  getPublicKey: () => PublicKey;
}

export function deriveKeys(
  publicKey: PublicKey,
  privateKey: KeyPairType['privateKey']
): { cipherKey: Uint8Array<ArrayBuffer>; macKey: Uint8Array<ArrayBuffer> } {
  const agreement = calculateAgreement(publicKey, privateKey);
  const [cipherKey, macKey] = deriveSecrets(
    agreement,
    new Uint8Array(32),
    fromString(PROVISIONING_STRING)
  );

  return { cipherKey, macKey };
}

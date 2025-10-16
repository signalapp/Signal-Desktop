// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import { PublicKey, Aci, Pni } from '@signalapp/libsignal-client';
import type { KeyPairType } from './Types.d.ts';
import * as Bytes from '../Bytes.std.js';
import {
  decryptAes256CbcPkcsPadding,
  deriveSecrets,
  verifyHmacSha256,
} from '../Crypto.node.js';
import {
  calculateAgreement,
  createKeyPair,
  generateKeyPair,
} from '../Curve.node.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { strictAssert } from '../util/assert.std.js';
import { dropNull } from '../util/dropNull.std.js';
import { normalizeAci } from '../util/normalizeAci.std.js';
import {
  type AciString,
  type PniString,
  normalizePni,
  toTaggedPni,
  isUntaggedPniString,
  fromAciObject,
  fromPniObject,
} from '../types/ServiceId.std.js';

export type ProvisionDecryptResult = Readonly<{
  aciKeyPair: KeyPairType;
  pniKeyPair?: KeyPairType;
  number?: string;
  aci: AciString;
  pni: PniString;
  provisioningCode?: string;
  userAgent?: string;
  readReceipts?: boolean;
  profileKey?: Uint8Array;
  masterKey?: Uint8Array;
  accountEntropyPool: string | undefined;
  mediaRootBackupKey: Uint8Array | undefined;
  ephemeralBackupKey: Uint8Array | undefined;
}>;

class ProvisioningCipherInner {
  keyPair?: KeyPairType;

  decrypt(provisionEnvelope: Proto.ProvisionEnvelope): ProvisionDecryptResult {
    strictAssert(
      provisionEnvelope.publicKey,
      'Missing publicKey in ProvisionEnvelope'
    );
    strictAssert(provisionEnvelope.body, 'Missing body in ProvisionEnvelope');
    const masterEphemeral = provisionEnvelope.publicKey;
    const message = provisionEnvelope.body;
    if (new Uint8Array(message)[0] !== 1) {
      throw new Error('Bad version number on ProvisioningMessage');
    }

    const iv = message.subarray(1, 16 + 1);
    const mac = message.subarray(message.byteLength - 32, message.byteLength);
    const ivAndCiphertext = message.subarray(0, message.byteLength - 32);
    const ciphertext = message.subarray(16 + 1, message.byteLength - 32);

    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.decrypt: No keypair!');
    }

    const ecRes = calculateAgreement(
      PublicKey.deserialize(masterEphemeral),
      this.keyPair.privateKey
    );
    const keys = deriveSecrets(
      ecRes,
      new Uint8Array(32),
      Bytes.fromString('TextSecure Provisioning Message')
    );
    verifyHmacSha256(ivAndCiphertext, keys[1], mac, 32);

    const plaintext = decryptAes256CbcPkcsPadding(keys[0], ciphertext, iv);
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
    let pni: PniString;
    if (Bytes.isNotEmpty(aciBinary) && Bytes.isNotEmpty(pniBinary)) {
      aci = fromAciObject(Aci.fromUuidBytes(aciBinary));
      pni = fromPniObject(Pni.fromUuidBytes(pniBinary));
    } else if (rawAci && rawUntaggedPni) {
      strictAssert(
        isUntaggedPniString(rawUntaggedPni),
        'ProvisioningCipher: invalid untaggedPni'
      );

      aci = normalizeAci(rawAci, 'provisionMessage.aci');
      pni = normalizePni(toTaggedPni(rawUntaggedPni), 'provisionMessage.pni');
    } else {
      throw new Error('Missing aci/pni in provisioning message');
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
      profileKey: Bytes.isNotEmpty(provisionMessage.profileKey)
        ? provisionMessage.profileKey
        : undefined,
      masterKey: Bytes.isNotEmpty(provisionMessage.masterKey)
        ? provisionMessage.masterKey
        : undefined,
      ephemeralBackupKey: Bytes.isNotEmpty(provisionMessage.ephemeralBackupKey)
        ? provisionMessage.ephemeralBackupKey
        : undefined,
      mediaRootBackupKey: Bytes.isNotEmpty(provisionMessage.mediaRootBackupKey)
        ? provisionMessage.mediaRootBackupKey
        : undefined,
      accountEntropyPool: provisionMessage.accountEntropyPool || undefined,
    };
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
    this.getPublicKey = inner.getPublicKey.bind(inner);
  }

  decrypt: (
    provisionEnvelope: Proto.ProvisionEnvelope
  ) => ProvisionDecryptResult;

  getPublicKey: () => PublicKey;
}

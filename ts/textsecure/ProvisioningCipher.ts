// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable max-classes-per-file */

import { KeyPairType } from './Types.d';
import { ProvisionEnvelopeClass } from '../textsecure.d';
import {
  decryptAes256CbcPkcsPadding,
  deriveSecrets,
  bytesFromString,
  verifyHmacSha256,
} from '../Crypto';
import { calculateAgreement, createKeyPair, generateKeyPair } from '../Curve';

type ProvisionDecryptResult = {
  identityKeyPair: KeyPairType;
  number?: string;
  uuid?: string;
  provisioningCode?: string;
  userAgent?: string;
  readReceipts?: boolean;
  profileKey?: ArrayBuffer;
};

class ProvisioningCipherInner {
  keyPair?: KeyPairType;

  async decrypt(
    provisionEnvelope: ProvisionEnvelopeClass
  ): Promise<ProvisionDecryptResult> {
    const masterEphemeral = provisionEnvelope.publicKey.toArrayBuffer();
    const message = provisionEnvelope.body.toArrayBuffer();
    if (new Uint8Array(message)[0] !== 1) {
      throw new Error('Bad version number on ProvisioningMessage');
    }

    const iv = message.slice(1, 16 + 1);
    const mac = message.slice(message.byteLength - 32, message.byteLength);
    const ivAndCiphertext = message.slice(0, message.byteLength - 32);
    const ciphertext = message.slice(16 + 1, message.byteLength - 32);

    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.decrypt: No keypair!');
    }

    const ecRes = calculateAgreement(masterEphemeral, this.keyPair.privKey);
    const keys = deriveSecrets(
      ecRes,
      new ArrayBuffer(32),
      bytesFromString('TextSecure Provisioning Message')
    );
    await verifyHmacSha256(ivAndCiphertext, keys[1], mac, 32);

    const plaintext = await decryptAes256CbcPkcsPadding(
      keys[0],
      ciphertext,
      iv
    );
    const provisionMessage = window.textsecure.protobuf.ProvisionMessage.decode(
      plaintext
    );
    const privKey = provisionMessage.identityKeyPrivate.toArrayBuffer();

    const keyPair = createKeyPair(privKey);
    window.normalizeUuids(
      provisionMessage,
      ['uuid'],
      'ProvisioningCipher.decrypt'
    );

    const ret: ProvisionDecryptResult = {
      identityKeyPair: keyPair,
      number: provisionMessage.number,
      uuid: provisionMessage.uuid,
      provisioningCode: provisionMessage.provisioningCode,
      userAgent: provisionMessage.userAgent,
      readReceipts: provisionMessage.readReceipts,
    };
    if (provisionMessage.profileKey) {
      ret.profileKey = provisionMessage.profileKey.toArrayBuffer();
    }
    return ret;
  }

  async getPublicKey(): Promise<ArrayBuffer> {
    if (!this.keyPair) {
      this.keyPair = generateKeyPair();
    }

    if (!this.keyPair) {
      throw new Error('ProvisioningCipher.decrypt: No keypair!');
    }

    return this.keyPair.pubKey;
  }
}

export default class ProvisioningCipher {
  constructor() {
    const inner = new ProvisioningCipherInner();

    this.decrypt = inner.decrypt.bind(inner);
    this.getPublicKey = inner.getPublicKey.bind(inner);
  }

  decrypt: (
    provisionEnvelope: ProvisionEnvelopeClass
  ) => Promise<ProvisionDecryptResult>;

  getPublicKey: () => Promise<ArrayBuffer>;
}

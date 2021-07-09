// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable more/no-then */
/* eslint-disable max-classes-per-file */

import { KeyPairType } from './Types.d';
import {
  decryptAes256CbcPkcsPadding,
  deriveSecrets,
  bytesFromString,
  verifyHmacSha256,
  typedArrayToArrayBuffer,
} from '../Crypto';
import { calculateAgreement, createKeyPair, generateKeyPair } from '../Curve';
import { SignalService as Proto } from '../protobuf';
import { strictAssert } from '../util/assert';
import { normalizeUuid } from '../util/normalizeUuid';

// TODO: remove once we move away from ArrayBuffers
const FIXMEU8 = Uint8Array;

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
    provisionEnvelope: Proto.ProvisionEnvelope
  ): Promise<ProvisionDecryptResult> {
    strictAssert(
      provisionEnvelope.publicKey && provisionEnvelope.body,
      'Missing required fields in ProvisionEnvelope'
    );
    const masterEphemeral = provisionEnvelope.publicKey;
    const message = provisionEnvelope.body;
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

    const ecRes = calculateAgreement(
      typedArrayToArrayBuffer(masterEphemeral),
      this.keyPair.privKey
    );
    const keys = deriveSecrets(
      ecRes,
      new ArrayBuffer(32),
      bytesFromString('TextSecure Provisioning Message')
    );
    await verifyHmacSha256(
      typedArrayToArrayBuffer(ivAndCiphertext),
      keys[1],
      typedArrayToArrayBuffer(mac),
      32
    );

    const plaintext = await decryptAes256CbcPkcsPadding(
      keys[0],
      typedArrayToArrayBuffer(ciphertext),
      typedArrayToArrayBuffer(iv)
    );
    const provisionMessage = Proto.ProvisionMessage.decode(
      new FIXMEU8(plaintext)
    );
    const privKey = provisionMessage.identityKeyPrivate;
    strictAssert(privKey, 'Missing identityKeyPrivate in ProvisionMessage');

    const keyPair = createKeyPair(typedArrayToArrayBuffer(privKey));

    const { uuid } = provisionMessage;
    strictAssert(uuid, 'Missing uuid in provisioning message');

    const ret: ProvisionDecryptResult = {
      identityKeyPair: keyPair,
      number: provisionMessage.number,
      uuid: normalizeUuid(uuid, 'ProvisionMessage.uuid'),
      provisioningCode: provisionMessage.provisioningCode,
      userAgent: provisionMessage.userAgent,
      readReceipts: provisionMessage.readReceipts,
    };
    if (provisionMessage.profileKey) {
      ret.profileKey = typedArrayToArrayBuffer(provisionMessage.profileKey);
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
    provisionEnvelope: Proto.ProvisionEnvelope
  ) => Promise<ProvisionDecryptResult>;

  getPublicKey: () => Promise<ArrayBuffer>;
}

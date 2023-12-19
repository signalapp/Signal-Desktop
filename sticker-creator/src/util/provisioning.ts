// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import b64 from 'base64-js';
import {
  generateKeyPair,
  sharedKey as computeSharedKey,
} from '@stablelib/x25519';

import { deriveKeys, decryptAttachment, encryptAttachment } from './crypto';
import {
  ProvisioningEnvelope,
  ProvisioningMessage,
  type IProvisioningMessage,
} from './protos';

const encoder = new TextEncoder();

const PROVISIONING_INFO = encoder.encode('Art Service Provisioning Message');

function prefixKey(key: Uint8Array): Uint8Array {
  if (key.length === 32) {
    return new Uint8Array([0x05, ...key]);
  }

  if (key.length !== 33 || key[0] !== 0x05) {
    throw new Error('Invalid key');
  }

  return key;
}

function unprefixKey(key: Uint8Array): Uint8Array {
  if (key.length === 32) {
    return key;
  }

  if (key.length !== 33 || key[0] !== 0x05) {
    throw new Error('Invalid key');
  }

  return key.slice(1);
}

export class Provisioning {
  protected constructor(
    private readonly privateKey: Uint8Array,
    public readonly publicKey: Uint8Array
  ) {}

  public static async create(): Promise<Provisioning> {
    const { secretKey: privateKey, publicKey } = generateKeyPair();

    return new Provisioning(privateKey, publicKey);
  }

  public getUrl(token: string): string {
    const url = new URL('sgnl://art-auth');
    url.searchParams.set('token', token);
    url.searchParams.set(
      'pub_key',
      b64.fromByteArray(prefixKey(this.publicKey))
    );
    return url.toString();
  }

  public async decryptMessage(
    envelopeData: Uint8Array
  ): Promise<IProvisioningMessage> {
    const envelope = ProvisioningEnvelope.decode(envelopeData);
    if (!envelope.publicKey) {
      throw new Error('Missing publicKey');
    }
    if (!envelope.ciphertext) {
      throw new Error('Missing ciphertext');
    }

    const secret = await computeSharedKey(
      this.privateKey,
      unprefixKey(envelope.publicKey)
    );
    const keys = await deriveKeys({ info: PROVISIONING_INFO, secret });

    const plaintext = await decryptAttachment(envelope.ciphertext, keys);
    return ProvisioningMessage.decode(plaintext);
  }

  public async encryptMessage(
    message: IProvisioningMessage,
    theirKey: Uint8Array
  ): Promise<Uint8Array> {
    const secret = computeSharedKey(this.privateKey, unprefixKey(theirKey));
    const keys = await deriveKeys({ info: PROVISIONING_INFO, secret });

    const plaintext = ProvisioningMessage.encode(message).finish();
    const ciphertext = await encryptAttachment(plaintext, keys);

    return ProvisioningEnvelope.encode({
      publicKey: this.publicKey,
      ciphertext,
    }).finish();
  }
}

// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrivateKey } from '@signalapp/libsignal-client';
import { ServerSecretParams } from '@signalapp/libsignal-client/zkgroup';

import {
  generateSenderCertificate,
  generateServerCertificate,
} from '../src/crypto';
import { Device } from '../src/data/device';
import {
  AciString,
  DeviceId,
  PniString,
  RegistrationId,
  ServiceIdKind,
} from '../src/types';
import { PrimaryDevice } from '../src/api/primary-device';

const trustRoot = PrivateKey.generate();
const serverCert = generateServerCertificate(trustRoot);
const serverSecretParams = ServerSecretParams.generate();

async function createPrimaryDevice(name: string): Promise<PrimaryDevice> {
  const aci = uuidv4() as AciString;
  const pni = `PNI:${uuidv4()}` as PniString;

  const device = new Device({
    aci,
    pni,
    number: '+1',
    deviceId: 1 as DeviceId,
    registrationId: 1 as RegistrationId,
    pniRegistrationId: 2 as RegistrationId,
    isProvisioned: false,
    authCredentialSalt: randomBytes(16),
  });

  const primary = new PrimaryDevice(device, {
    trustRoot: trustRoot.getPublicKey(),
    serverPublicParams: serverSecretParams.getPublicParams(),
    profileName: name,
    contacts: {
      attachmentIdentifier: null,
      clientUuid: null,
      contentType: null,
      key: null,
      size: null,
      thumbnail: null,
      digest: null,
      incrementalMac: null,
      chunkSize: null,
      fileName: null,
      flags: null,
      width: null,
      height: null,
      caption: null,
      blurHash: null,
      uploadTimestamp: null,
      cdnNumber: null,
    },

    async getSenderCertificate() {
      return generateSenderCertificate(serverCert, {
        number: device.number,
        aci: device.aci,
        deviceId: device.deviceId,
        identityKey: await device.getIdentityKey(ServiceIdKind.ACI),
      });
    },

    async generateNumber() {
      throw new Error('Should not be called');
    },
    async generatePni() {
      throw new Error('Should not be called');
    },
    async changeDeviceNumber() {
      throw new Error('Should not be called');
    },
    async send() {
      throw new Error('Should not be called');
    },
    async getDeviceByServiceId() {
      throw new Error('Not implemented');
    },
    async issueExpiringProfileKeyCredential() {
      throw new Error('Not implemented');
    },
    async getGroup() {
      throw new Error('Not implemented');
    },
    async createGroup() {
      throw new Error('Not implemented');
    },
    async modifyGroup() {
      throw new Error('Not implemented');
    },
    async waitForGroupUpdate() {
      throw new Error('Not implemented');
    },
    getStorageManifest() {
      throw new Error('Not implemented');
    },
    getStorageItem() {
      throw new Error('Not implemented');
    },
    getAllStorageKeys() {
      throw new Error('Not implemented');
    },
    async waitForStorageManifest() {
      throw new Error('Not implemented');
    },
    async applyStorageWrite() {
      throw new Error('Not implemented');
    },
  });

  await primary.init();

  return primary;
}

// The idea of the test here is to verify that PrimaryDevice is capable of:
// - Generating prekeys
// - Adding prekeys from other accounts
// - Encrypting/decrypting messages
describe('PrimaryDevice', () => {
  it('should send and receive messages', async () => {
    const alice = await createPrimaryDevice('Alice');
    const bob = await createPrimaryDevice('Bob');

    const key = await bob.device.popSingleUseKey(ServiceIdKind.ACI);
    await alice.addSingleUseKey(bob.device, key);

    const encrypted = await alice.encryptText(bob.device, 'Hello');
    await bob.receive(alice.device, encrypted);

    const message = await bob.waitForMessage();
    assert.strictEqual(message.body, 'Hello');
    assert.strictEqual(message.source, alice.device);
  });
});

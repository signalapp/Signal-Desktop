// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { constantTimeEqual } from '../../Crypto.js';
import { generateKeyPair } from '../../Curve.js';
import type {
  UploadKeysType,
  UploadPreKeyType,
} from '../../textsecure/WebAPI.js';
import AccountManager from '../../textsecure/AccountManager.js';
import { ServiceIdKind } from '../../types/ServiceId.js';
import { normalizeAci } from '../../util/normalizeAci.js';
import { DataWriter } from '../../sql/Client.js';
import { signalProtocolStore } from '../../SignalProtocolStore.js';

const { textsecure } = window;

const assertEqualBuffers = (a: Uint8Array, b: Uint8Array) => {
  assert.isTrue(constantTimeEqual(a, b));
};

describe('Key generation', function (this: Mocha.Suite) {
  const count = 10;
  const ourServiceId = normalizeAci(
    'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
    'test'
  );
  let result: UploadKeysType;
  this.timeout(count * 2000);

  function itStoresPreKey(keyId: number): void {
    it(`prekey ${keyId} is valid`, async () => {
      const keyPair = await signalProtocolStore.loadPreKey(ourServiceId, keyId);
      assert(keyPair, `PreKey ${keyId} not found`);
    });
  }
  function itStoresKyberPreKey(keyId: number): void {
    it(`kyber pre key ${keyId} is valid`, async () => {
      const key = await signalProtocolStore.loadKyberPreKey(
        ourServiceId,
        keyId
      );
      assert(key, `kyber pre key ${keyId} not found`);
    });
  }

  async function validateResultPreKey(
    resultKey: UploadPreKeyType
  ): Promise<void> {
    const keyPair = await signalProtocolStore.loadPreKey(
      ourServiceId,
      resultKey.keyId
    );
    if (!keyPair) {
      throw new Error(`PreKey ${resultKey.keyId} not found`);
    }
    assertEqualBuffers(
      resultKey.publicKey.serialize(),
      keyPair.publicKey().serialize()
    );
  }

  before(async () => {
    await signalProtocolStore.clearPreKeyStore();
    await signalProtocolStore.clearKyberPreKeyStore();
    await signalProtocolStore.clearSignedPreKeysStore();

    const keyPair = generateKeyPair();
    await textsecure.storage.put('identityKeyMap', {
      [ourServiceId]: {
        pubKey: keyPair.publicKey.serialize(),
        privKey: keyPair.privateKey.serialize(),
      },
    });
    await textsecure.storage.user.setAciAndDeviceId(ourServiceId, 1);

    await signalProtocolStore.hydrateCaches();
  });

  after(async () => {
    await signalProtocolStore.clearPreKeyStore();
    await signalProtocolStore.clearKyberPreKeyStore();
    await signalProtocolStore.clearSignedPreKeysStore();

    await DataWriter.removeAll();
    await window.storage.fetch();
  });

  describe('the first time', () => {
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager._generateSingleUseKeys(
        ServiceIdKind.ACI,
        count
      );
    });

    describe('generates the basics', () => {
      for (let i = 1; i <= count; i += 1) {
        itStoresPreKey(i);
      }
      for (let i = 1; i <= count; i += 1) {
        itStoresKyberPreKey(i);
      }
    });

    it(`result contains ${count} preKeys`, () => {
      const preKeys = result.preKeys || [];
      assert.isArray(preKeys);
      assert.lengthOf(preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      const preKeys = result.preKeys || [];
      for (let i = 0; i < count; i += 1) {
        assert.strictEqual(preKeys[i].keyId, i + 1);
      }
    });
    it('result contains the correct public keys', async () => {
      const preKeys = result.preKeys || [];
      await Promise.all(preKeys.map(validateResultPreKey));
    });
  });
  describe('the second time', () => {
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager._generateSingleUseKeys(
        ServiceIdKind.ACI,
        count
      );
    });

    describe('generates the basics', () => {
      for (let i = 1; i <= 2 * count; i += 1) {
        itStoresPreKey(i);
      }
      for (let i = 1; i <= 2 * count; i += 1) {
        itStoresKyberPreKey(i);
      }
    });

    it(`result contains ${count} preKeys`, () => {
      const preKeys = result.preKeys || [];
      assert.isArray(preKeys);
      assert.lengthOf(preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      const preKeys = result.preKeys || [];
      for (let i = 1; i <= count; i += 1) {
        assert.strictEqual(preKeys[i - 1].keyId, i + count);
      }
    });
    it('result contains the correct public keys', async () => {
      const preKeys = result.preKeys || [];
      await Promise.all(preKeys.map(validateResultPreKey));
    });
  });
  describe('the third time, after keys are confirmed', () => {
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);

      await accountManager._confirmKeys(result, ServiceIdKind.ACI);

      result = await accountManager._generateSingleUseKeys(
        ServiceIdKind.ACI,
        count
      );
    });

    describe('generates the basics', () => {
      for (let i = 1; i <= 3 * count; i += 1) {
        itStoresPreKey(i);
      }
      // Note: no new last resort kyber key generated
      for (let i = 1; i <= 3 * count; i += 1) {
        itStoresKyberPreKey(i);
      }
    });

    it(`result contains ${count} preKeys`, () => {
      const preKeys = result.preKeys || [];
      assert.isArray(preKeys);
      assert.lengthOf(preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      const preKeys = result.preKeys || [];
      for (let i = 1; i <= count; i += 1) {
        assert.strictEqual(preKeys[i - 1].keyId, i + 2 * count);
      }
    });
    it('result contains the correct public keys', async () => {
      const preKeys = result.preKeys || [];
      await Promise.all(preKeys.map(validateResultPreKey));
    });
    it('does not generate a third last resort prekey', async () => {
      const keyId = 3 * count + 3;
      const key = await signalProtocolStore.loadKyberPreKey(
        ourServiceId,
        keyId
      );
      assert.isUndefined(key, `kyber pre key ${keyId} was unexpectedly found`);
    });
    it('does not generate a third signed prekey', async () => {
      const keyId = 3;
      const keyPair = await signalProtocolStore.loadSignedPreKey(
        ourServiceId,
        keyId
      );
      assert.isUndefined(
        keyPair,
        `SignedPreKey ${keyId} was unexpectedly found`
      );
    });
  });
});

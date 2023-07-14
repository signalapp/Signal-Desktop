// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { constantTimeEqual } from '../../Crypto';
import { generateKeyPair } from '../../Curve';
import type { UploadKeysType } from '../../textsecure/WebAPI';
import AccountManager from '../../textsecure/AccountManager';
import type { PreKeyType, SignedPreKeyType } from '../../textsecure/Types.d';
import { UUID, UUIDKind } from '../../types/UUID';

const { textsecure } = window;

const assertEqualBuffers = (a: Uint8Array, b: Uint8Array) => {
  assert.isTrue(constantTimeEqual(a, b));
};

describe('Key generation', function thisNeeded() {
  const count = 10;
  const ourUuid = new UUID('aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');
  let result: UploadKeysType;
  this.timeout(count * 2000);

  function itStoresPreKey(keyId: number): void {
    it(`prekey ${keyId} is valid`, async () => {
      const keyPair = await textsecure.storage.protocol.loadPreKey(
        ourUuid,
        keyId
      );
      assert(keyPair, `PreKey ${keyId} not found`);
    });
  }
  function itStoresKyberPreKey(keyId: number): void {
    it(`kyber pre key ${keyId} is valid`, async () => {
      const key = await textsecure.storage.protocol.loadKyberPreKey(
        ourUuid,
        keyId
      );
      assert(key, `kyber pre key ${keyId} not found`);
    });
  }
  function itStoresSignedPreKey(keyId: number): void {
    it(`signed prekey ${keyId} is valid`, async () => {
      const keyPair = await textsecure.storage.protocol.loadSignedPreKey(
        ourUuid,
        keyId
      );
      assert(keyPair, `SignedPreKey ${keyId} not found`);
    });
  }

  async function validateResultPreKey(
    resultKey: Pick<PreKeyType, 'keyId' | 'publicKey'>
  ): Promise<void> {
    const keyPair = await textsecure.storage.protocol.loadPreKey(
      ourUuid,
      resultKey.keyId
    );
    if (!keyPair) {
      throw new Error(`PreKey ${resultKey.keyId} not found`);
    }
    assertEqualBuffers(resultKey.publicKey, keyPair.publicKey().serialize());
  }
  async function validateResultSignedKey(
    resultSignedKey?: Pick<SignedPreKeyType, 'keyId' | 'publicKey'>
  ) {
    if (!resultSignedKey) {
      throw new Error('validateResultSignedKey: No signed prekey provided!');
    }
    const keyPair = await textsecure.storage.protocol.loadSignedPreKey(
      ourUuid,
      resultSignedKey.keyId
    );
    if (!keyPair) {
      throw new Error(`SignedPreKey ${resultSignedKey.keyId} not found`);
    }
    assertEqualBuffers(
      resultSignedKey.publicKey,
      keyPair.publicKey().serialize()
    );
  }

  before(async () => {
    await textsecure.storage.protocol.clearPreKeyStore();
    await textsecure.storage.protocol.clearKyberPreKeyStore();
    await textsecure.storage.protocol.clearSignedPreKeysStore();

    const keyPair = generateKeyPair();
    await textsecure.storage.put('identityKeyMap', {
      [ourUuid.toString()]: keyPair,
    });
    await textsecure.storage.user.setUuidAndDeviceId(ourUuid.toString(), 1);

    await textsecure.storage.protocol.hydrateCaches();
  });

  after(async () => {
    await textsecure.storage.protocol.clearPreKeyStore();
    await textsecure.storage.protocol.clearKyberPreKeyStore();
    await textsecure.storage.protocol.clearSignedPreKeysStore();
  });

  describe('the first time', () => {
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager._generateKeys(count, UUIDKind.ACI);
    });

    describe('generates the basics', () => {
      for (let i = 1; i <= count; i += 1) {
        itStoresPreKey(i);
      }
      for (let i = 1; i <= count + 1; i += 1) {
        itStoresKyberPreKey(i);
      }
      itStoresSignedPreKey(1);
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
    it('returns a signed prekey', () => {
      assert.strictEqual(result.signedPreKey?.keyId, 1);
      assert.instanceOf(result.signedPreKey?.signature, Uint8Array);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe('the second time', () => {
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager._generateKeys(count, UUIDKind.ACI);
    });

    describe('generates the basics', () => {
      for (let i = 1; i <= 2 * count; i += 1) {
        itStoresPreKey(i);
      }
      for (let i = 1; i <= 2 * count + 2; i += 1) {
        itStoresKyberPreKey(i);
      }
      itStoresSignedPreKey(1);
      itStoresSignedPreKey(2);
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
    it('returns a signed prekey', () => {
      assert.strictEqual(result.signedPreKey?.keyId, 2);
      assert.instanceOf(result.signedPreKey?.signature, Uint8Array);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe('the third time, after keys are confirmed', () => {
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);

      await accountManager._confirmKeys(result, UUIDKind.ACI);

      result = await accountManager._generateKeys(count, UUIDKind.ACI);
    });

    describe('generates the basics', () => {
      for (let i = 1; i <= 3 * count; i += 1) {
        itStoresPreKey(i);
      }
      // Note: no new last resort kyber key generated
      for (let i = 1; i <= 3 * count + 2; i += 1) {
        itStoresKyberPreKey(i);
      }
      itStoresSignedPreKey(1);
      itStoresSignedPreKey(2);
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
      const key = await textsecure.storage.protocol.loadKyberPreKey(
        ourUuid,
        keyId
      );
      assert.isUndefined(key, `kyber pre key ${keyId} was unexpectedly found`);
    });
    it('does not generate a third signed prekey', async () => {
      const keyId = 3;
      const keyPair = await textsecure.storage.protocol.loadSignedPreKey(
        ourUuid,
        keyId
      );
      assert.isUndefined(
        keyPair,
        `SignedPreKey ${keyId} was unexpectedly found`
      );
    });
  });
});

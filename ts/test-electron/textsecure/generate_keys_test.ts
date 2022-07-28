// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { constantTimeEqual } from '../../Crypto';
import { generateKeyPair } from '../../Curve';
import type { GeneratedKeysType } from '../../textsecure/AccountManager';
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
  function itStoresSignedPreKey(keyId: number): void {
    it(`signed prekey ${keyId} is valid`, async () => {
      const keyPair = await textsecure.storage.protocol.loadSignedPreKey(
        ourUuid,
        keyId
      );
      assert(keyPair, `SignedPreKey ${keyId} not found`);
    });
  }
  async function validateResultKey(
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
    resultSignedKey: Pick<SignedPreKeyType, 'keyId' | 'publicKey'>
  ) {
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
    const keyPair = generateKeyPair();
    await textsecure.storage.put('identityKeyMap', {
      [ourUuid.toString()]: keyPair,
    });
    await textsecure.storage.user.setUuidAndDeviceId(ourUuid.toString(), 1);
    await textsecure.storage.protocol.hydrateCaches();
  });

  after(async () => {
    await textsecure.storage.protocol.clearPreKeyStore();
    await textsecure.storage.protocol.clearSignedPreKeysStore();
  });

  describe('the first time', () => {
    let result: GeneratedKeysType;

    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager.generateKeys(count, UUIDKind.ACI);
    });

    for (let i = 1; i <= count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(1);

    it(`result contains ${count} preKeys`, () => {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      for (let i = 0; i < count; i += 1) {
        assert.strictEqual(result.preKeys[i].keyId, i + 1);
      }
    });
    it('result contains the correct public keys', async () => {
      await Promise.all(result.preKeys.map(validateResultKey));
    });
    it('returns a signed prekey', () => {
      assert.strictEqual(result.signedPreKey.keyId, 1);
      assert.instanceOf(result.signedPreKey.signature, Uint8Array);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe('the second time', () => {
    let result: GeneratedKeysType;
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager.generateKeys(count, UUIDKind.ACI);
    });

    for (let i = 1; i <= 2 * count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(1);
    itStoresSignedPreKey(2);
    it(`result contains ${count} preKeys`, () => {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      for (let i = 1; i <= count; i += 1) {
        assert.strictEqual(result.preKeys[i - 1].keyId, i + count);
      }
    });
    it('result contains the correct public keys', async () => {
      await Promise.all(result.preKeys.map(validateResultKey));
    });
    it('returns a signed prekey', () => {
      assert.strictEqual(result.signedPreKey.keyId, 2);
      assert.instanceOf(result.signedPreKey.signature, Uint8Array);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe('the third time', () => {
    let result: GeneratedKeysType;
    before(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountManager = new AccountManager({} as any);
      result = await accountManager.generateKeys(count, UUIDKind.ACI);
    });

    for (let i = 1; i <= 3 * count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(2);
    itStoresSignedPreKey(3);
    it(`result contains ${count} preKeys`, () => {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      for (let i = 1; i <= count; i += 1) {
        assert.strictEqual(result.preKeys[i - 1].keyId, i + 2 * count);
      }
    });
    it('result contains the correct public keys', async () => {
      await Promise.all(result.preKeys.map(validateResultKey));
    });
    it('result contains a signed prekey', () => {
      assert.strictEqual(result.signedPreKey.keyId, 3);
      assert.instanceOf(result.signedPreKey.signature, Uint8Array);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
});

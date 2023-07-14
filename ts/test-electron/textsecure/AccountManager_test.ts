// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { range } from 'lodash';

import { getRandomBytes } from '../../Crypto';
import AccountManager from '../../textsecure/AccountManager';
import type {
  KyberPreKeyType,
  OuterSignedPrekeyType,
  PreKeyType,
} from '../../textsecure/Types.d';
import { UUID, UUIDKind } from '../../types/UUID';
import { DAY } from '../../util/durations';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AccountManager', () => {
  let accountManager: AccountManager;

  const ourUuid = UUID.generate();
  const identityKey = window.Signal.Curve.generateKeyPair();
  const pubKey = getRandomBytes(33);
  const privKey = getRandomBytes(32);

  let originalGetIdentityKeyPair: any;
  let originalGetUuid: any;
  let originalGetCheckedUuid: any;

  beforeEach(() => {
    const server: any = {};
    accountManager = new AccountManager(server);

    originalGetIdentityKeyPair =
      window.textsecure.storage.protocol.getIdentityKeyPair;
    originalGetUuid = window.textsecure.storage.user.getUuid;
    originalGetCheckedUuid = window.textsecure.storage.user.getCheckedUuid;

    window.textsecure.storage.protocol.getIdentityKeyPair = () => identityKey;
    window.textsecure.storage.user.getUuid = () => ourUuid;
    window.textsecure.storage.user.getCheckedUuid = () => ourUuid;
  });

  afterEach(() => {
    window.textsecure.storage.protocol.getIdentityKeyPair =
      originalGetIdentityKeyPair;
    window.textsecure.storage.user.getUuid = originalGetUuid;
    window.textsecure.storage.user.getCheckedUuid = originalGetCheckedUuid;
  });

  describe('encrypted device name', () => {
    it('roundtrips', async () => {
      const deviceName = 'v2.5.0 on Ubunto 20.04';
      const encrypted = accountManager.encryptDeviceName(
        deviceName,
        identityKey
      );
      if (!encrypted) {
        throw new Error('failed to encrypt!');
      }
      assert.strictEqual(typeof encrypted, 'string');
      const decrypted = await accountManager.decryptDeviceName(encrypted);

      assert.strictEqual(decrypted, deviceName);
    });

    it('handles falsey deviceName', () => {
      const encrypted = accountManager.encryptDeviceName('', identityKey);
      assert.strictEqual(encrypted, null);
    });
  });

  describe('#_cleanSignedPreKeys', () => {
    let originalLoadSignedPreKeys: any;
    let originalRemoveSignedPreKey: any;
    let signedPreKeys: Array<OuterSignedPrekeyType>;

    beforeEach(async () => {
      originalLoadSignedPreKeys =
        window.textsecure.storage.protocol.loadSignedPreKeys;
      originalRemoveSignedPreKey =
        window.textsecure.storage.protocol.removeSignedPreKeys;

      window.textsecure.storage.protocol.loadSignedPreKeys = () =>
        signedPreKeys;
      // removeSignedPreKeys is updated per-test, below
    });
    afterEach(() => {
      window.textsecure.storage.protocol.loadSignedPreKeys =
        originalLoadSignedPreKeys;
      window.textsecure.storage.protocol.removeSignedPreKeys =
        originalRemoveSignedPreKey;
    });

    it('keeps no keys if five or less, even if over a month old', () => {
      const now = Date.now();
      signedPreKeys = [
        {
          keyId: 1,
          created_at: now - DAY * 32,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 2,
          created_at: now - DAY * 34,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 3,
          created_at: now - DAY * 38,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 4,
          created_at: now - DAY * 39,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 5,
          created_at: now - DAY * 40,
          confirmed: false,
          pubKey,
          privKey,
        },
      ];

      // should be no calls to store.removeSignedPreKey, would cause crash
      return accountManager._cleanSignedPreKeys(UUIDKind.ACI);
    });

    it('eliminates oldest keys, even if recent key is unconfirmed', async () => {
      const now = Date.now();
      signedPreKeys = [
        {
          keyId: 1,
          created_at: now - DAY * 32,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 2,
          created_at: now - DAY * 31,
          confirmed: false,
          pubKey,
          privKey,
        },
        {
          keyId: 3,
          created_at: now - DAY * 24,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          // Oldest, should be dropped
          keyId: 4,
          created_at: now - DAY * 38,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 5,
          created_at: now - DAY,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 6,
          created_at: now - DAY * 5,
          confirmed: true,
          pubKey,
          privKey,
        },
      ];

      let removedKeys: Array<number> = [];
      window.textsecure.storage.protocol.removeSignedPreKeys = async (
        _,
        keyIds
      ) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanSignedPreKeys(UUIDKind.ACI);
      assert.deepEqual(removedKeys, [4]);
    });
  });

  describe('#_cleanLastResortKeys', () => {
    let originalLoadKyberPreKeys: any;
    let originalRemoveKyberPreKey: any;
    let kyberPreKeys: Array<KyberPreKeyType>;

    beforeEach(async () => {
      originalLoadKyberPreKeys =
        window.textsecure.storage.protocol.loadKyberPreKeys;
      originalRemoveKyberPreKey =
        window.textsecure.storage.protocol.removeKyberPreKeys;

      window.textsecure.storage.protocol.loadKyberPreKeys = () => kyberPreKeys;
      // removeKyberPreKeys is updated per-test, below
    });
    afterEach(() => {
      window.textsecure.storage.protocol.loadKyberPreKeys =
        originalLoadKyberPreKeys;
      window.textsecure.storage.protocol.removeKyberPreKeys =
        originalRemoveKyberPreKey;
    });

    it('keeps five keys even if over a month old', () => {
      const now = Date.now();
      kyberPreKeys = [
        {
          id: `${ourUuid.toString()}:1`,

          createdAt: now - DAY * 32,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 1,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:2`,

          createdAt: now - DAY * 34,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 2,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:3`,

          createdAt: now - DAY * 38,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 3,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:4`,

          createdAt: now - DAY * 39,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: false,
          keyId: 4,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:5`,

          createdAt: now - DAY * 40,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: false,
          keyId: 5,
          ourUuid: ourUuid.toString(),
        },
      ];

      // should be no calls to store.removeKyberPreKey, would cause crash
      return accountManager._cleanLastResortKeys(UUIDKind.ACI);
    });

    it('eliminates oldest keys, even if recent key is unconfirmed', async () => {
      const now = Date.now();
      kyberPreKeys = [
        {
          id: `${ourUuid.toString()}:1`,

          createdAt: now - DAY * 32,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 1,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:2`,

          createdAt: now - DAY * 31,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: false,
          keyId: 2,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:3`,

          createdAt: now - DAY * 24,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 3,
          ourUuid: ourUuid.toString(),
        },
        {
          // Oldest, should be dropped
          id: `${ourUuid.toString()}:4`,

          createdAt: now - DAY * 38,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 4,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:5`,

          createdAt: now - DAY * 5,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 5,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:6`,

          createdAt: now - DAY * 5,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 6,
          ourUuid: ourUuid.toString(),
        },
      ];

      let removedKeys: Array<number> = [];
      window.textsecure.storage.protocol.removeKyberPreKeys = async (
        _,
        keyIds
      ) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanLastResortKeys(UUIDKind.ACI);
      assert.deepEqual(removedKeys, [4]);
    });
  });

  describe('#_cleanPreKeys', () => {
    let originalLoadPreKeys: any;
    let originalRemovePreKeys: any;
    let preKeys: Array<PreKeyType>;

    beforeEach(async () => {
      originalLoadPreKeys = window.textsecure.storage.protocol.loadPreKeys;
      originalRemovePreKeys = window.textsecure.storage.protocol.removePreKeys;

      window.textsecure.storage.protocol.loadPreKeys = () => preKeys;
      // removePreKeys is updated per-test, below
    });
    afterEach(() => {
      window.textsecure.storage.protocol.loadPreKeys = originalLoadPreKeys;
      window.textsecure.storage.protocol.removePreKeys = originalRemovePreKeys;
    });

    it('keeps five keys even if over 90 days old, but all latest batch', () => {
      const now = Date.now();
      preKeys = [
        {
          id: `${ourUuid.toString()}:1`,

          createdAt: now - DAY * 92,
          keyId: 1,
          ourUuid: ourUuid.toString(),
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourUuid.toString()}:2`,

          createdAt: now - DAY * 93,
          keyId: 2,
          ourUuid: ourUuid.toString(),
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourUuid.toString()}:3`,

          createdAt: now - DAY * 93,
          keyId: 3,
          ourUuid: ourUuid.toString(),
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourUuid.toString()}:4`,

          createdAt: now - DAY * 93,
          keyId: 4,
          ourUuid: ourUuid.toString(),
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourUuid.toString()}:5`,

          createdAt: now - DAY * 94,
          keyId: 5,
          ourUuid: ourUuid.toString(),
          privateKey: privKey,
          publicKey: pubKey,
        },
      ];

      // should be no calls to store.removeKyberPreKey, would cause crash
      return accountManager._cleanPreKeys(UUIDKind.ACI);
    });

    it('eliminates keys not in the 200 newest, over 90 days old', async () => {
      const now = Date.now();
      preKeys = [
        // The latest batch
        ...range(0, 100).map(
          (id): PreKeyType => ({
            id: `${ourUuid.toString()}:${id}`,

            createdAt: now - DAY,
            keyId: 1,
            ourUuid: ourUuid.toString(),
            privateKey: privKey,
            publicKey: pubKey,
          })
        ),
        // Second-oldest batch, won't be dropped
        ...range(100, 200).map(
          (id): PreKeyType => ({
            id: `${ourUuid.toString()}:${id}`,

            createdAt: now - DAY * 40,
            keyId: 1,
            ourUuid: ourUuid.toString(),
            privateKey: privKey,
            publicKey: pubKey,
          })
        ),
        // Oldest batch, will be dropped
        {
          id: `${ourUuid.toString()}:6`,

          createdAt: now - DAY * 92,
          keyId: 6,
          ourUuid: ourUuid.toString(),
          privateKey: privKey,
          publicKey: pubKey,
        },
      ];

      let removedKeys: Array<number> = [];
      window.textsecure.storage.protocol.removePreKeys = async (_, keyIds) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanPreKeys(UUIDKind.ACI);
      assert.deepEqual(removedKeys, [6]);
    });
  });

  describe('#_cleanKyberPreKeys', () => {
    let originalLoadKyberPreKeys: any;
    let originalRemoveKyberPreKeys: any;
    let kyberPreKeys: Array<KyberPreKeyType>;

    beforeEach(async () => {
      originalLoadKyberPreKeys =
        window.textsecure.storage.protocol.loadKyberPreKeys;
      originalRemoveKyberPreKeys =
        window.textsecure.storage.protocol.removeKyberPreKeys;

      window.textsecure.storage.protocol.loadKyberPreKeys = () => kyberPreKeys;
      // removeKyberPreKeys is updated per-test, below
    });
    afterEach(() => {
      window.textsecure.storage.protocol.loadKyberPreKeys =
        originalLoadKyberPreKeys;
      window.textsecure.storage.protocol.removeKyberPreKeys =
        originalRemoveKyberPreKeys;
    });

    it('keeps five keys even if over 90 days old', () => {
      const now = Date.now();
      kyberPreKeys = [
        {
          id: `${ourUuid.toString()}:1`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 1,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:2`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 2,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:3`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 3,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:4`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 4,
          ourUuid: ourUuid.toString(),
        },
        {
          id: `${ourUuid.toString()}:5`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 5,
          ourUuid: ourUuid.toString(),
        },
      ];

      // should be no calls to store.removeKyberPreKey, would cause crash
      return accountManager._cleanKyberPreKeys(UUIDKind.ACI);
    });

    it('eliminates keys not in the newest 200, over 90 days old', async () => {
      const now = Date.now();
      kyberPreKeys = [
        // The latest batch
        ...range(0, 100).map(
          (id): KyberPreKeyType => ({
            id: `${ourUuid.toString()}:${id}`,

            createdAt: now - DAY,
            data: getRandomBytes(32),
            isConfirmed: false,
            isLastResort: false,
            keyId: 1,
            ourUuid: ourUuid.toString(),
          })
        ),
        // Second-oldest batch, won't be dropped
        ...range(100, 200).map(
          (id): KyberPreKeyType => ({
            id: `${ourUuid.toString()}:${id}`,

            createdAt: now - DAY * 45,
            data: getRandomBytes(32),
            isConfirmed: false,
            isLastResort: false,
            keyId: 4,
            ourUuid: ourUuid.toString(),
          })
        ),
        // Oldest batch, will be dropped
        {
          id: `${ourUuid.toString()}:6`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 6,
          ourUuid: ourUuid.toString(),
        },
      ];

      let removedKeys: Array<number> = [];
      window.textsecure.storage.protocol.removeKyberPreKeys = async (
        _,
        keyIds
      ) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanKyberPreKeys(UUIDKind.ACI);
      assert.deepEqual(removedKeys, [6]);
    });
  });
});

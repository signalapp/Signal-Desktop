// Copyright 2017-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as getGuid } from 'uuid';

import { getRandomBytes } from '../../Crypto';
import AccountManager from '../../textsecure/AccountManager';
import type { OuterSignedPrekeyType } from '../../textsecure/Types.d';
import { UUID } from '../../types/UUID';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AccountManager', () => {
  let accountManager: AccountManager;

  beforeEach(() => {
    const server: any = {};
    accountManager = new AccountManager(server);
  });

  describe('#cleanSignedPreKeys', () => {
    let originalGetIdentityKeyPair: any;
    let originalLoadSignedPreKeys: any;
    let originalRemoveSignedPreKey: any;
    let originalGetUuid: any;
    let signedPreKeys: Array<OuterSignedPrekeyType>;
    const DAY = 1000 * 60 * 60 * 24;

    const pubKey = getRandomBytes(33);
    const privKey = getRandomBytes(32);
    const identityKey = window.Signal.Curve.generateKeyPair();

    beforeEach(async () => {
      const ourUuid = new UUID(getGuid());

      originalGetUuid = window.textsecure.storage.user.getUuid;
      originalGetIdentityKeyPair =
        window.textsecure.storage.protocol.getIdentityKeyPair;
      originalLoadSignedPreKeys =
        window.textsecure.storage.protocol.loadSignedPreKeys;
      originalRemoveSignedPreKey =
        window.textsecure.storage.protocol.removeSignedPreKey;

      window.textsecure.storage.user.getUuid = () => ourUuid;

      window.textsecure.storage.protocol.getIdentityKeyPair = async () =>
        identityKey;
      window.textsecure.storage.protocol.loadSignedPreKeys = async () =>
        signedPreKeys;
    });
    afterEach(() => {
      window.textsecure.storage.user.getUuid = originalGetUuid;
      window.textsecure.storage.protocol.getIdentityKeyPair =
        originalGetIdentityKeyPair;
      window.textsecure.storage.protocol.loadSignedPreKeys =
        originalLoadSignedPreKeys;
      window.textsecure.storage.protocol.removeSignedPreKey =
        originalRemoveSignedPreKey;
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

    it('keeps three confirmed keys even if over a month old', () => {
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
      ];

      // should be no calls to store.removeSignedPreKey, would cause crash
      return accountManager.cleanSignedPreKeys();
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

      let count = 0;
      window.textsecure.storage.protocol.removeSignedPreKey = async (
        _,
        keyId
      ) => {
        if (keyId !== 4) {
          throw new Error(`Wrong keys were eliminated! ${keyId}`);
        }

        count += 1;
      };

      await accountManager.cleanSignedPreKeys();
      assert.strictEqual(count, 1);
    });

    it('Removes no keys if less than five', async () => {
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
          created_at: now - DAY * 44,
          confirmed: true,
          pubKey,
          privKey,
        },
        {
          keyId: 3,
          created_at: now - DAY * 36,
          confirmed: false,
          pubKey,
          privKey,
        },
        {
          keyId: 4,
          created_at: now - DAY * 20,
          confirmed: false,
          pubKey,
          privKey,
        },
      ];

      window.textsecure.storage.protocol.removeSignedPreKey = async () => {
        throw new Error('None should be removed!');
      };

      await accountManager.cleanSignedPreKeys();
    });
  });
});

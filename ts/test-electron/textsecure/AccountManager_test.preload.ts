// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import lodash from 'lodash';
import * as sinon from 'sinon';

import { getRandomBytes } from '../../Crypto.node.js';
import { generateKeyPair } from '../../Curve.node.js';
import AccountManager from '../../textsecure/AccountManager.preload.js';
import type {
  KyberPreKeyType,
  OuterSignedPrekeyType,
  PreKeyType,
} from '../../textsecure/Types.d.ts';
import {
  ServiceIdKind,
  generateAci,
  generatePni,
} from '../../types/ServiceId.std.js';
import { DAY } from '../../util/durations/index.std.js';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { range } = lodash;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('AccountManager', () => {
  let sandbox: sinon.SinonSandbox;
  const accountManager = new AccountManager();

  const ourAci = generateAci();
  const ourPni = generatePni();
  const identityKey = generateKeyPair();
  const pubKey = getRandomBytes(33);
  const privKey = getRandomBytes(32);

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    sandbox
      .stub(signalProtocolStore, 'getIdentityKeyPair')
      .returns(identityKey);
    const { user } = itemStorage;
    sandbox.stub(user, 'getAci').returns(ourAci);
    sandbox.stub(user, 'getPni').returns(ourPni);
    sandbox.stub(user, 'getServiceId').returns(ourAci);
    sandbox.stub(user, 'getCheckedAci').returns(ourAci);
    sandbox.stub(user, 'getCheckedPni').returns(ourPni);
    sandbox.stub(user, 'getCheckedServiceId').returns(ourAci);
  });

  afterEach(() => {
    sandbox.restore();
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
      assert.strictEqual(encrypted, undefined);
    });
  });

  describe('#_cleanSignedPreKeys', () => {
    let originalLoadSignedPreKeys: any;
    let originalRemoveSignedPreKey: any;
    let signedPreKeys: Array<OuterSignedPrekeyType>;

    beforeEach(async () => {
      originalLoadSignedPreKeys = signalProtocolStore.loadSignedPreKeys;
      originalRemoveSignedPreKey = signalProtocolStore.removeSignedPreKeys;

      signalProtocolStore.loadSignedPreKeys = () => signedPreKeys;
      // removeSignedPreKeys is updated per-test, below
    });
    afterEach(() => {
      signalProtocolStore.loadSignedPreKeys = originalLoadSignedPreKeys;
      signalProtocolStore.removeSignedPreKeys = originalRemoveSignedPreKey;
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
      return accountManager._cleanSignedPreKeys(ServiceIdKind.ACI);
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
      signalProtocolStore.removeSignedPreKeys = async (_, keyIds) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanSignedPreKeys(ServiceIdKind.ACI);
      assert.deepEqual(removedKeys, [4]);
    });
  });

  describe('#_cleanLastResortKeys', () => {
    let originalLoadKyberPreKeys: any;
    let originalRemoveKyberPreKey: any;
    let kyberPreKeys: Array<KyberPreKeyType>;

    beforeEach(async () => {
      originalLoadKyberPreKeys = signalProtocolStore.loadKyberPreKeys;
      originalRemoveKyberPreKey = signalProtocolStore.removeKyberPreKeys;

      signalProtocolStore.loadKyberPreKeys = () => kyberPreKeys;
      // removeKyberPreKeys is updated per-test, below
    });
    afterEach(() => {
      signalProtocolStore.loadKyberPreKeys = originalLoadKyberPreKeys;
      signalProtocolStore.removeKyberPreKeys = originalRemoveKyberPreKey;
    });

    it('keeps five keys even if over a month old', () => {
      const now = Date.now();
      kyberPreKeys = [
        {
          id: `${ourAci}:1`,

          createdAt: now - DAY * 32,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 1,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:2`,

          createdAt: now - DAY * 34,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 2,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:3`,

          createdAt: now - DAY * 38,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 3,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:4`,

          createdAt: now - DAY * 39,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: false,
          keyId: 4,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:5`,

          createdAt: now - DAY * 40,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: false,
          keyId: 5,
          ourServiceId: ourAci,
        },
      ];

      // should be no calls to store.removeKyberPreKey, would cause crash
      return accountManager._cleanLastResortKeys(ServiceIdKind.ACI);
    });

    it('eliminates oldest keys, even if recent key is unconfirmed', async () => {
      const now = Date.now();
      kyberPreKeys = [
        {
          id: `${ourAci}:1`,

          createdAt: now - DAY * 32,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 1,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:2`,

          createdAt: now - DAY * 31,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: false,
          keyId: 2,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:3`,

          createdAt: now - DAY * 24,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 3,
          ourServiceId: ourAci,
        },
        {
          // Oldest, should be dropped
          id: `${ourAci}:4`,

          createdAt: now - DAY * 38,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 4,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:5`,

          createdAt: now - DAY * 5,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 5,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:6`,

          createdAt: now - DAY * 5,
          data: getRandomBytes(32),
          isLastResort: true,
          isConfirmed: true,
          keyId: 6,
          ourServiceId: ourAci,
        },
      ];

      let removedKeys: Array<number> = [];
      signalProtocolStore.removeKyberPreKeys = async (_, keyIds) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanLastResortKeys(ServiceIdKind.ACI);
      assert.deepEqual(removedKeys, [4]);
    });
  });

  describe('#_cleanPreKeys', () => {
    let originalLoadPreKeys: any;
    let originalRemovePreKeys: any;
    let preKeys: Array<PreKeyType>;

    beforeEach(async () => {
      originalLoadPreKeys = signalProtocolStore.loadPreKeys;
      originalRemovePreKeys = signalProtocolStore.removePreKeys;

      signalProtocolStore.loadPreKeys = () => preKeys;
      // removePreKeys is updated per-test, below
    });
    afterEach(() => {
      signalProtocolStore.loadPreKeys = originalLoadPreKeys;
      signalProtocolStore.removePreKeys = originalRemovePreKeys;
    });

    it('keeps five keys even if over 90 days old, but all latest batch', () => {
      const now = Date.now();
      preKeys = [
        {
          id: `${ourAci}:1`,

          createdAt: now - DAY * 92,
          keyId: 1,
          ourServiceId: ourAci,
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourAci}:2`,

          createdAt: now - DAY * 93,
          keyId: 2,
          ourServiceId: ourAci,
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourAci}:3`,

          createdAt: now - DAY * 93,
          keyId: 3,
          ourServiceId: ourAci,
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourAci}:4`,

          createdAt: now - DAY * 93,
          keyId: 4,
          ourServiceId: ourAci,
          privateKey: privKey,
          publicKey: pubKey,
        },
        {
          id: `${ourAci}:5`,

          createdAt: now - DAY * 94,
          keyId: 5,
          ourServiceId: ourAci,
          privateKey: privKey,
          publicKey: pubKey,
        },
      ];

      // should be no calls to store.removeKyberPreKey, would cause crash
      return accountManager._cleanPreKeys(ServiceIdKind.ACI);
    });

    it('eliminates keys not in the 200 newest, over 90 days old', async () => {
      const now = Date.now();
      preKeys = [
        // The latest batch
        ...range(0, 100).map(
          (id): PreKeyType => ({
            id: `${ourAci}:${id}`,

            createdAt: now - DAY,
            keyId: 1,
            ourServiceId: ourAci,
            privateKey: privKey,
            publicKey: pubKey,
          })
        ),
        // Second-oldest batch, won't be dropped
        ...range(100, 200).map(
          (id): PreKeyType => ({
            id: `${ourAci}:${id}`,

            createdAt: now - DAY * 40,
            keyId: 1,
            ourServiceId: ourAci,
            privateKey: privKey,
            publicKey: pubKey,
          })
        ),
        // Oldest batch, will be dropped
        {
          id: `${ourAci}:6`,

          createdAt: now - DAY * 92,
          keyId: 6,
          ourServiceId: ourAci,
          privateKey: privKey,
          publicKey: pubKey,
        },
      ];

      let removedKeys: Array<number> = [];
      signalProtocolStore.removePreKeys = async (_, keyIds) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanPreKeys(ServiceIdKind.ACI);
      assert.deepEqual(removedKeys, [6]);
    });
  });

  describe('#_cleanKyberPreKeys', () => {
    let originalLoadKyberPreKeys: any;
    let originalRemoveKyberPreKeys: any;
    let kyberPreKeys: Array<KyberPreKeyType>;

    beforeEach(async () => {
      originalLoadKyberPreKeys = signalProtocolStore.loadKyberPreKeys;
      originalRemoveKyberPreKeys = signalProtocolStore.removeKyberPreKeys;

      signalProtocolStore.loadKyberPreKeys = () => kyberPreKeys;
      // removeKyberPreKeys is updated per-test, below
    });
    afterEach(() => {
      signalProtocolStore.loadKyberPreKeys = originalLoadKyberPreKeys;
      signalProtocolStore.removeKyberPreKeys = originalRemoveKyberPreKeys;
    });

    it('keeps five keys even if over 90 days old', () => {
      const now = Date.now();
      kyberPreKeys = [
        {
          id: `${ourAci}:1`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 1,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:2`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 2,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:3`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 3,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:4`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 4,
          ourServiceId: ourAci,
        },
        {
          id: `${ourAci}:5`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 5,
          ourServiceId: ourAci,
        },
      ];

      // should be no calls to store.removeKyberPreKey, would cause crash
      return accountManager._cleanKyberPreKeys(ServiceIdKind.ACI);
    });

    it('eliminates keys not in the newest 200, over 90 days old', async () => {
      const now = Date.now();
      kyberPreKeys = [
        // The latest batch
        ...range(0, 100).map(
          (id): KyberPreKeyType => ({
            id: `${ourAci}:${id}`,

            createdAt: now - DAY,
            data: getRandomBytes(32),
            isConfirmed: false,
            isLastResort: false,
            keyId: 1,
            ourServiceId: ourAci,
          })
        ),
        // Second-oldest batch, won't be dropped
        ...range(100, 200).map(
          (id): KyberPreKeyType => ({
            id: `${ourAci}:${id}`,

            createdAt: now - DAY * 45,
            data: getRandomBytes(32),
            isConfirmed: false,
            isLastResort: false,
            keyId: 4,
            ourServiceId: ourAci,
          })
        ),
        // Oldest batch, will be dropped
        {
          id: `${ourAci}:6`,

          createdAt: now - DAY * 93,
          data: getRandomBytes(32),
          isConfirmed: false,
          isLastResort: false,
          keyId: 6,
          ourServiceId: ourAci,
        },
      ];

      let removedKeys: Array<number> = [];
      signalProtocolStore.removeKyberPreKeys = async (_, keyIds) => {
        removedKeys = removedKeys.concat(keyIds);
      };

      await accountManager._cleanKyberPreKeys(ServiceIdKind.ACI);
      assert.deepEqual(removedKeys, [6]);
    });
  });
});

describe('AccountManager', () => {
  let accountManager;

  beforeEach(() => {
    accountManager = new window.textsecure.AccountManager();
  });

  describe('#cleanSignedPreKeys', () => {
    let originalProtocolStorage;
    let signedPreKeys;
    const DAY = 1000 * 60 * 60 * 24;

    beforeEach(() => {
      originalProtocolStorage = window.textsecure.storage.protocol;
      window.textsecure.storage.protocol = {
        loadSignedPreKeys() {
          return Promise.resolve(signedPreKeys);
        },
      };
    });
    afterEach(() => {
      window.textsecure.storage.protocol = originalProtocolStorage;
    });

    it('keeps three confirmed keys even if over a week old', () => {
      const now = Date.now();
      signedPreKeys = [
        {
          keyId: 1,
          created_at: now - DAY * 21,
          confirmed: true,
        },
        {
          keyId: 2,
          created_at: now - DAY * 14,
          confirmed: true,
        },
        {
          keyId: 3,
          created_at: now - DAY * 18,
          confirmed: true,
        },
      ];

      // should be no calls to store.removeSignedPreKey, would cause crash
      return accountManager.cleanSignedPreKeys();
    });

    it('eliminates confirmed keys over a week old, if more than three', async () => {
      const now = Date.now();
      signedPreKeys = [
        {
          keyId: 1,
          created_at: now - DAY * 21,
          confirmed: true,
        },
        {
          keyId: 2,
          created_at: now - DAY * 14,
          confirmed: true,
        },
        {
          keyId: 3,
          created_at: now - DAY * 4,
          confirmed: true,
        },
        {
          keyId: 4,
          created_at: now - DAY * 18,
          confirmed: true,
        },
        {
          keyId: 5,
          created_at: now - DAY,
          confirmed: true,
        },
      ];

      let count = 0;
      window.textsecure.storage.protocol.removeSignedPreKey = keyId => {
        if (keyId !== 1 && keyId !== 4) {
          throw new Error(`Wrong keys were eliminated! ${keyId}`);
        }

        count += 1;
      };

      await accountManager.cleanSignedPreKeys();
      assert.strictEqual(count, 2);
    });

    it('keeps at least three unconfirmed keys if no confirmed', async () => {
      const now = Date.now();
      signedPreKeys = [
        {
          keyId: 1,
          created_at: now - DAY * 14,
        },
        {
          keyId: 2,
          created_at: now - DAY * 21,
        },
        {
          keyId: 3,
          created_at: now - DAY * 18,
        },
        {
          keyId: 4,
          created_at: now - DAY,
        },
      ];

      let count = 0;
      window.textsecure.storage.protocol.removeSignedPreKey = keyId => {
        if (keyId !== 2) {
          throw new Error(`Wrong keys were eliminated! ${keyId}`);
        }

        count += 1;
      };

      await accountManager.cleanSignedPreKeys();
      assert.strictEqual(count, 1);
    });

    it('if some confirmed keys, keeps unconfirmed to addd up to three total', async () => {
      const now = Date.now();
      signedPreKeys = [
        {
          keyId: 1,
          created_at: now - DAY * 21,
          confirmed: true,
        },
        {
          keyId: 2,
          created_at: now - DAY * 14,
          confirmed: true,
        },
        {
          keyId: 3,
          created_at: now - DAY * 12,
        },
        {
          keyId: 4,
          created_at: now - DAY * 8,
        },
      ];

      let count = 0;
      window.textsecure.storage.protocol.removeSignedPreKey = keyId => {
        if (keyId !== 3) {
          throw new Error(`Wrong keys were eliminated! ${keyId}`);
        }

        count += 1;
      };

      await accountManager.cleanSignedPreKeys();
      assert.strictEqual(count, 1);
    });
  });
});

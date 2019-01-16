/* global storage */

/* eslint no-await-in-loop: 0 */

'use strict';

const PROFILE_ID = 'local-profile';

describe('Profile', () => {
  beforeEach(async () => {
    await clearDatabase();
    await storage.remove(PROFILE_ID);
  });

  describe('getLocalProfile', () => {
    it('returns the local profile', async () => {
      const values = [null, 'hello', { a: 'b' }];
      for(let i = 0; i < values.length; i += 1) {
        await storage.put(PROFILE_ID, values[i]);
        assert.strictEqual(values[i], storage.getLocalProfile());
      }
    });
  });

  describe('saveLocalProfile', () => {
    it('saves a profile', async () => {
      const values = [null, 'hello', { a: 'b' }];
      for(let i = 0; i < values.length; i += 1) {
        await storage.saveLocalProfile(values[i]);
        assert.strictEqual(values[i], storage.get(PROFILE_ID));
      }
    });
  });

  describe('removeLocalProfile', () => {
    it('removes a profile', async () => {
      await storage.saveLocalProfile('a');
      assert.strictEqual('a', storage.getLocalProfile());

      await storage.removeLocalProfile();
      assert.strictEqual(null, storage.getLocalProfile());
    });
  });

  describe('setProfileName', () => {
    it('throws if a name is not a string', async () => {
      const values = [0, { a: 'b'}, [1, 2]];
      for(let i = 0; i < values.length; i += 1) {
        try {
          await storage.setProfileName(values[i]);
          assert.fail(`setProfileName did not throw an error for ${typeof values[i]}`);
        } catch (e) {
          assert.throws(() => { throw e; }, 'Name must be a string!');
        }
      }
    });

    it('does not throw if we pass a string or null', async () => {
      const values = [null, '1'];
      for(let i = 0; i < values.length; i += 1) {
        try {
          await storage.setProfileName(values[i]);
        } catch (e) {
          assert.fail('setProfileName threw an error');
        }
      }
    });

    it('saves the display name', async () => {
      await storage.setProfileName('hi there!');

      const expected = {
        displayName: 'hi there!',
      };
      const profile = storage.getLocalProfile();
      assert.exists(profile.name);
      assert.deepEqual(expected, profile.name);
    });

    it('saves the display name without overwriting the other profile properties', async () => {
      const profile = { title: 'hello' };
      await storage.put(PROFILE_ID, profile);
      await storage.setProfileName('hi there!');

      const expected = {
        ...profile,
        name: {
          displayName: 'hi there!',
        },
      };
      assert.deepEqual(expected, storage.getLocalProfile());
    });

    it('trims the display name', async () => {
      await storage.setProfileName('  in    middle  ');
      const profile = storage.getLocalProfile();
      const name = {
        displayName: 'in    middle',
      };
      assert.deepEqual(name, profile.name);
    });

    it('unsets the name property if it is empty', async () => {
      const profile = {
        name: {
          displayName: 'HI THERE!',
        },
      };
      await storage.put(PROFILE_ID, profile);
      assert.exists(storage.getLocalProfile().name);

      await storage.setProfileName('');
      assert.notExists(storage.getLocalProfile().name);
    });
  });
});

import { expect } from 'chai';
import * as sinon from 'sinon';
import { BlockedNumberController } from '../../util/blockedNumberController';
import { TestUtils } from '../test-utils';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';

// tslint:disable-next-line: max-func-body-length
describe('BlockedNumberController', () => {
  const sandbox = sinon.createSandbox();
  let memoryDB: { [key: string]: any };
  beforeEach(() => {
    memoryDB = {};

    TestUtils.stubData('createOrUpdateItem').callsFake(data => {
      memoryDB[data.id] = data.value;
    });

    TestUtils.stubData('getItemById').callsFake(id => {
      if (!memoryDB[id]) {
        return undefined;
      }
      const value = memoryDB[id];
      return {
        id,
        value,
      };
    });

    BlockedNumberController.reset();
  });

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  describe('load', async () => {
    it('should load data from the database', async () => {
      const normal = TestUtils.generateFakePubKey();
      const group = TestUtils.generateFakePubKey();
      memoryDB.blocked = [normal.key];
      memoryDB['blocked-groups'] = [group.key];
      await BlockedNumberController.load();

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      const blockedGroups = BlockedNumberController.getBlockedGroups();

      expect(blockedNumbers).to.have.lengthOf(1);
      expect(blockedNumbers).to.include(normal.key);
      expect(blockedGroups).to.have.lengthOf(1);
      expect(blockedGroups).to.include(group.key);
    });

    it('should return empty if nothing in the db exists', async () => {
      await BlockedNumberController.load();
      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      const blockedGroups = BlockedNumberController.getBlockedGroups();

      expect(blockedNumbers).to.be.empty;
      expect(blockedGroups).to.be.empty;
    });
  });

  describe('block', async () => {
    it('should block the user', async () => {
      const other = TestUtils.generateFakePubKey();

      await BlockedNumberController.block(other);

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers).to.have.lengthOf(1);
      expect(blockedNumbers).to.include(other.key);
      expect(memoryDB.blocked).to.include(other.key);
      expect(BlockedNumberController.getBlockedGroups()).to.be.empty;
    });
  });

  describe('unblock', async () => {
    it('should unblock the user', async () => {
      const primary = TestUtils.generateFakePubKey();
      memoryDB.blocked = [primary.key];

      await BlockedNumberController.unblock(primary);

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers).to.be.empty;
      expect(memoryDB.blocked).to.be.empty;
    });

    it('should only unblock if a device was blocked', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      const another = TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key, another.key];

      await BlockedNumberController.unblock(pubKey);

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers).to.have.lengthOf(1);
      expect(blockedNumbers).to.include(another.key);
      expect(memoryDB.blocked).to.have.lengthOf(1);
      expect(memoryDB.blocked).to.include(another.key);
    });
  });

  describe('blockGroup', async () => {
    it('should block a group', async () => {
      const group = TestUtils.generateFakePubKey();

      await BlockedNumberController.blockGroup(group);

      const blockedGroups = BlockedNumberController.getBlockedGroups();
      expect(blockedGroups).to.have.lengthOf(1);
      expect(blockedGroups).to.include(group.key);
      expect(memoryDB['blocked-groups']).to.have.lengthOf(1);
      expect(memoryDB['blocked-groups']).to.include(group.key);
      expect(BlockedNumberController.getBlockedNumbers()).to.be.empty;
    });
  });

  describe('unblockGroup', async () => {
    it('should unblock a group', async () => {
      const group = TestUtils.generateFakePubKey();
      const another = TestUtils.generateFakePubKey();
      memoryDB['blocked-groups'] = [group.key, another.key];

      await BlockedNumberController.unblockGroup(group);

      const blockedGroups = BlockedNumberController.getBlockedGroups();
      expect(blockedGroups).to.have.lengthOf(1);
      expect(blockedGroups).to.include(another.key);
      expect(memoryDB['blocked-groups']).to.have.lengthOf(1);
      expect(memoryDB['blocked-groups']).to.include(another.key);
    });
  });

  describe('isBlocked', async () => {
    it('should return true if number is blocked', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      const groupPubKey = TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key];
      memoryDB['blocked-groups'] = [groupPubKey.key];
      await BlockedNumberController.load();
      expect(BlockedNumberController.isBlocked(pubKey.key)).to.equal(
        true,
        'Expected isBlocked to return true for user pubkey'
      );
      expect(BlockedNumberController.isBlocked(groupPubKey.key)).to.equal(
        false,
        'Expected isBlocked to return false for a group pubkey'
      );
    });

    it('should return false if number is not blocked', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      memoryDB.blocked = [];
      await BlockedNumberController.load();
      expect(BlockedNumberController.isBlocked(pubKey.key)).to.equal(
        false,
        'Expected isBlocked to return false'
      );
    });
  });

  describe('isBlockedAsync', () => {
    let ourDevice: PubKey;
    beforeEach(() => {
      ourDevice = TestUtils.generateFakePubKey();
      sandbox
        .stub(UserUtils, 'getOurPubKeyStrFromCache')
        .returns(ourDevice.key);
    });
    it('should return false for our device', async () => {
      const isBlocked = await BlockedNumberController.isBlockedAsync(ourDevice);
      expect(isBlocked).to.equal(false, 'Expected our device to return false');
    });

    it('should return true if the device is blocked', async () => {
      const other = TestUtils.generateFakePubKey();
      memoryDB.blocked = [other.key];

      const isBlocked = await BlockedNumberController.isBlockedAsync(other);
      expect(isBlocked).to.equal(
        true,
        'Expected isBlockedAsync to return true.'
      );
    });

    it('should return false if device is not blocked', async () => {
      const other = TestUtils.generateFakePubKey();
      memoryDB.blocked = [];

      const isBlocked = await BlockedNumberController.isBlockedAsync(other);
      expect(isBlocked).to.equal(
        false,
        'Expected isBlockedAsync to return false.'
      );
    });
  });

  describe('isGroupBlocked', async () => {
    it('should return true if group is blocked', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      const groupPubKey = TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key];
      memoryDB['blocked-groups'] = [groupPubKey.key];
      await BlockedNumberController.load();
      expect(BlockedNumberController.isGroupBlocked(pubKey.key)).to.equal(
        false,
        'Expected isGroupBlocked to return false for user pubkey'
      );
      expect(BlockedNumberController.isGroupBlocked(groupPubKey.key)).to.equal(
        true,
        'Expected isGroupBlocked to return true for a group pubkey'
      );
    });

    it('should return false if group is not blocked', async () => {
      const groupPubKey = TestUtils.generateFakePubKey();
      memoryDB['blocked-groups'] = [];
      await BlockedNumberController.load();
      expect(BlockedNumberController.isGroupBlocked(groupPubKey.key)).to.equal(
        false,
        'Expected isGroupBlocked to return false'
      );
    });
  });
});

import { expect } from 'chai';
import Sinon from 'sinon';
import { BlockedNumberController } from '../../util/blockedNumberController';
import { TestUtils } from '../test-utils';

describe('BlockedNumberController', () => {
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
    Sinon.restore();
  });

  describe('load', () => {
    it('should load data from the database', async () => {
      const normal = TestUtils.generateFakePubKey();
      memoryDB.blocked = [normal.key];
      await BlockedNumberController.load();

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();

      expect(blockedNumbers).to.have.lengthOf(1);
      expect(blockedNumbers).to.include(normal.key);
    });

    it('should return empty if nothing in the db exists', async () => {
      await BlockedNumberController.load();
      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers.length).to.be.eq(0);
    });
  });

  describe('block', () => {
    it('should block the user', async () => {
      const other = TestUtils.generateFakePubKey();

      await BlockedNumberController.block(other);

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers).to.have.lengthOf(1);
      expect(blockedNumbers).to.include(other.key);
      expect(memoryDB.blocked).to.include(other.key);
    });
  });

  describe('unblock', () => {
    it('should unblock the user', async () => {
      const primary = TestUtils.generateFakePubKey();
      memoryDB.blocked = [primary.key];

      await BlockedNumberController.unblockAll([primary.key]);

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers.length).to.be.eq(0);
      expect(Object.keys(memoryDB.blocked).length).to.be.be.eq(0);
    });

    it('should only unblock if a device was blocked', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      const another = TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key, another.key];

      await BlockedNumberController.unblockAll([pubKey.key]);

      const blockedNumbers = BlockedNumberController.getBlockedNumbers();
      expect(blockedNumbers).to.have.lengthOf(1);
      expect(blockedNumbers).to.include(another.key);
      expect(memoryDB.blocked).to.have.lengthOf(1);
      expect(memoryDB.blocked).to.include(another.key);
    });
  });

  describe('isBlocked', () => {
    it('should return true if number is blocked', async () => {
      const pubKey = TestUtils.generateFakePubKey();
      memoryDB.blocked = [pubKey.key];
      await BlockedNumberController.load();
      expect(BlockedNumberController.isBlocked(pubKey.key)).to.equal(
        true,
        'Expected isBlocked to return true for user pubkey'
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
});

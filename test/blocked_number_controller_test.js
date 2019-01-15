/* global textsecure, BlockedNumberController, storage */

'use strict';

describe('Blocked Number Controller', () => {

  beforeEach(async () => {
    const numbers = storage.getBlockedNumbers();
    numbers.forEach(storage.removeBlockedNumber);
    window.getBlockedNumbers().reset([]);
  });

  describe('getAll', () => {
    it('returns our blocked numbers', () => {
      assert.isEmpty(BlockedNumberController.getAll().models);

      BlockedNumberController.block('1');
      BlockedNumberController.block('2');
      assert.lengthOf(BlockedNumberController.getAll().models, 2);
    });
  });

  describe('reset', () => {
    it('clears blocked numbers', () => {
      BlockedNumberController.block('1');
      assert.isNotEmpty(BlockedNumberController.getAll().models);

      BlockedNumberController.reset();
      assert.isEmpty(BlockedNumberController.getAll().models);
    });
  });

  describe('load', () => {
    it('loads blocked numbers from storage', () => {
      BlockedNumberController.load();
      assert.isEmpty(window.getBlockedNumbers().models);

      storage.addBlockedNumber('1');
      storage.addBlockedNumber('2');
      BlockedNumberController.load();
      assert.lengthOf(window.getBlockedNumbers().models, 2);
    });

    it('throws if we have already loaded numbers', () => {
      storage.addBlockedNumber('2');
      BlockedNumberController.load();
      assert.throws(() => BlockedNumberController.load(), 'BlockedNumberController: Already loaded!');
    });

    it('throws if storage is invalid', () => {
      const _storage = window.storage;
      window.storage = null;
      assert.throws(() => BlockedNumberController.load(), 'BlockedNumberController: Could not load blocked numbers');
      window.storage = _storage;
    });
  });

  describe('block', () => {
    beforeEach(() => {
      BlockedNumberController.load();
      assert.isEmpty(BlockedNumberController.getAll().models);
    });

    it('adds number to the blocked list', () => {
      assert.isEmpty(storage.getBlockedNumbers());

      BlockedNumberController.block('1');

      const numbers = BlockedNumberController.getAll().models;
      assert.lengthOf(numbers, 1);
      assert.strictEqual('1', numbers[0].get('number'))
      assert.deepEqual(['1'], storage.getBlockedNumbers());
    });

    it('only blocks the same number once', () => {
      BlockedNumberController.block('2');
      BlockedNumberController.block('2');
      assert.lengthOf(BlockedNumberController.getAll().models, 1);
      assert.deepEqual(['2'], storage.getBlockedNumbers());
    });

    it('does not block our own number', () => {
      BlockedNumberController.block(textsecure.storage.user.getNumber());
      assert.isEmpty(BlockedNumberController.getAll().models);
      assert.isEmpty(storage.getBlockedNumbers());
    });
  });

  describe('unblock', () => {
    beforeEach(() => {
      BlockedNumberController.load();
      assert.isEmpty(BlockedNumberController.getAll().models);
    });

    it('removes number from the blocked list', () => {
      BlockedNumberController.block('1');
      BlockedNumberController.block('2');

      assert.lengthOf(BlockedNumberController.getAll().models, 2);
      assert.lengthOf(storage.getBlockedNumbers(), 2);

      BlockedNumberController.unblock('1');

      const numbers = BlockedNumberController.getAll().models;
      assert.lengthOf(numbers, 1);
      assert.isEmpty(numbers.filter(n => n.get('number') === '1'));
      assert.deepEqual(['2'], storage.getBlockedNumbers());
    });

    it('removes number from the blocked list even if it is not present in the collection', () => {
      BlockedNumberController.block('1');
      BlockedNumberController.block('2');
      window.getBlockedNumbers().reset([]);

      assert.isEmpty(window.getBlockedNumbers().models);
      assert.lengthOf(storage.getBlockedNumbers(), 2);

      BlockedNumberController.unblock('1');
      assert.deepEqual(['2'], storage.getBlockedNumbers());
    });
  });

  describe('unblockAll', () => {
    it('removes all our blocked numbers', () => {
      BlockedNumberController.load();

      BlockedNumberController.block('1');
      BlockedNumberController.block('2');
      BlockedNumberController.block('3');

      assert.lengthOf(BlockedNumberController.getAll().models, 3);
      assert.lengthOf(storage.getBlockedNumbers(), 3);

      BlockedNumberController.unblockAll();

      assert.lengthOf(BlockedNumberController.getAll().models, 0);
      assert.lengthOf(storage.getBlockedNumbers(), 0);
    });
  });

  describe('isBlocked', () => {
    it('returns whether a number is blocked', () => {
      BlockedNumberController.load();

      BlockedNumberController.block('1');
      assert.isOk(BlockedNumberController.isBlocked('1'));
      assert.isNotOk(BlockedNumberController.isBlocked('2'));

      BlockedNumberController.unblock('1');
      assert.isNotOk(BlockedNumberController.isBlocked('1'));
    });
  });
});
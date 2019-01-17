/* global textsecure, BlockedNumberController, storage */

'use strict';

describe('Blocked Number Controller', () => {
  beforeEach(async () => {
    // Purge everything manually
    const numbers = storage.getBlockedNumbers();
    numbers.forEach(storage.removeBlockedNumber);
    window.getBlockedNumbers().reset([]);
  });

  describe('reset', () => {
    it('clears blocked numbers', () => {
      BlockedNumberController.block('1');
      assert.isNotEmpty(storage.getBlockedNumbers());
      assert.isNotEmpty(window.getBlockedNumbers().models);

      BlockedNumberController.reset();
      assert.isEmpty(storage.getBlockedNumbers());
      assert.isEmpty(window.getBlockedNumbers().models);
    });
  });

  describe('refresh', () => {
    it('loads blocked numbers from storage', () => {
      BlockedNumberController.refresh();
      assert.isEmpty(window.getBlockedNumbers().models);

      storage.addBlockedNumber('1');
      storage.addBlockedNumber('2');
      BlockedNumberController.refresh();

      const blocked = window.getBlockedNumbers().map(m => m.get('number'));
      assert.lengthOf(blocked, 2);
      assert.deepEqual(['1', '2'], blocked.sort());
    });

    it('overrides old numbers if we refresh again', () => {
      BlockedNumberController.refresh();
      assert.isEmpty(window.getBlockedNumbers().models);

      storage.addBlockedNumber('1');
      BlockedNumberController.refresh();
      assert.isNotEmpty(
        window.getBlockedNumbers().find(m => m.get('number') === '1')
      );

      storage.removeBlockedNumber('1');
      storage.addBlockedNumber('2');
      BlockedNumberController.refresh();
      assert.isNotEmpty(
        window.getBlockedNumbers().find(m => m.get('number') === '2')
      );
    });

    it('throws if storage is invalid', () => {
      const _storage = window.storage;
      window.storage = null;
      assert.throws(
        () => BlockedNumberController.refresh(),
        'BlockedNumberController: Could not load blocked numbers'
      );
      window.storage = _storage;
    });
  });

  describe('block', () => {
    beforeEach(() => {
      BlockedNumberController.refresh();
      assert.isEmpty(storage.getBlockedNumbers());
      assert.isEmpty(window.getBlockedNumbers().models);
    });

    it('adds number to the blocked list', () => {
      BlockedNumberController.block('1');

      const numbers = window.getBlockedNumbers().models;
      assert.lengthOf(numbers, 1);
      assert.strictEqual('1', numbers[0].get('number'));
      assert.deepEqual(['1'], storage.getBlockedNumbers());
    });

    it('only blocks the same number once', () => {
      BlockedNumberController.block('2');
      BlockedNumberController.block('2');
      assert.lengthOf(window.getBlockedNumbers().models, 1);
      assert.deepEqual(['2'], storage.getBlockedNumbers());
    });

    it('does not block our own number', () => {
      BlockedNumberController.block(textsecure.storage.user.getNumber());
      assert.isEmpty(window.getBlockedNumbers().models);
      assert.isEmpty(storage.getBlockedNumbers());
    });
  });

  describe('unblock', () => {
    beforeEach(() => {
      BlockedNumberController.refresh();
      assert.isEmpty(storage.getBlockedNumbers());
      assert.isEmpty(window.getBlockedNumbers().models);
    });

    it('removes number from the blocked list', () => {
      BlockedNumberController.block('1');
      BlockedNumberController.block('2');

      assert.lengthOf(window.getBlockedNumbers().models, 2);
      assert.lengthOf(storage.getBlockedNumbers(), 2);

      BlockedNumberController.unblock('1');

      const numbers = window.getBlockedNumbers().models;
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
      BlockedNumberController.refresh();

      BlockedNumberController.block('1');
      BlockedNumberController.block('2');
      BlockedNumberController.block('3');

      assert.lengthOf(window.getBlockedNumbers().models, 3);
      assert.lengthOf(storage.getBlockedNumbers(), 3);

      BlockedNumberController.unblockAll();

      assert.lengthOf(window.getBlockedNumbers().models, 0);
      assert.lengthOf(storage.getBlockedNumbers(), 0);
    });
  });

  describe('isBlocked', () => {
    it('returns whether a number is blocked', () => {
      BlockedNumberController.refresh();

      BlockedNumberController.block('1');
      assert.isOk(BlockedNumberController.isBlocked('1'));
      assert.isNotOk(BlockedNumberController.isBlocked('2'));

      BlockedNumberController.unblock('1');
      assert.isNotOk(BlockedNumberController.isBlocked('1'));
    });
  });
});

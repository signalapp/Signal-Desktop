/* global , Whisper, storage */
/* global textsecure: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const blockedNumbers = new Whisper.BlockedNumberCollection();
  window.getBlockedNumbers = () => blockedNumbers;

  window.BlockedNumberController = {
    reset() {
      this.unblockAll();
      blockedNumbers.reset([]);
    },
    refresh() {
      window.log.info('BlockedNumberController: starting initial fetch');

      if (!storage) {
        throw new Error(
          'BlockedNumberController: Could not load blocked numbers'
        );
      }

      // Add the numbers to the collection
      const numbers = storage.getBlockedNumbers();
      blockedNumbers.reset(numbers.map(number => ({ number })));
    },
    block(number) {
      const ourNumber = textsecure.storage.user.getNumber();

      // Make sure we don't block ourselves
      if (ourNumber === number) {
        window.log.info('BlockedNumberController: Cannot block yourself!');
        return;
      }

      storage.addBlockedNumber(number);

      // Make sure we don't add duplicates
      if (blockedNumbers.getModel(number)) {
        return;
      }

      blockedNumbers.add({ number });
    },
    unblock(number) {
      storage.removeBlockedNumber(number);

      // Remove the model from our collection
      const model = blockedNumbers.getModel(number);
      if (model) {
        blockedNumbers.remove(model);
      }
    },
    unblockAll() {
      const numbers = blockedNumbers.map(m => m.get('number'));
      numbers.forEach(n => this.unblock(n));
    },
    isBlocked(number) {
      return storage.isBlocked(number);
    },
  };
})();

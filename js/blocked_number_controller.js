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
        blockedNumbers.reset([]);
      },
      load() {
        window.log.info('BlockedNumberController: starting initial fetch');
  
        if (blockedNumbers.length) {
          throw new Error('BlockedNumberController: Already loaded!');
        }

        if (!storage) {
          throw new Error('BlockedNumberController: Could not load blocked numbers');
        }

        // Add the numbers to the collection
        const numbers = storage.getBlockedNumbers();
        blockedNumbers.add(
          numbers.map(number => ({ number }))
        );
      },
      block(number) {
        const ourNumber = textsecure.storage.user.getNumber();

        // Make sure we don't block ourselves
        if (ourNumber === number) {
          window.log.info('BlockedNumberController: Cannot block yourself!');
          return null;
        }

        storage.addBlockedNumber(number);

        // Make sure we don't add duplicates
        const exists = blockedNumbers.getNumber(number);
        if (exists)
          return exists;

        return blockedNumbers.add({ number });
      },
      unblock(number) {
        storage.removeBlockedNumber(number);

        // Make sure we don't add duplicates
        const exists = blockedNumbers.getNumber(number);
        if (exists) {
          blockedNumbers.remove(exists);
          return exists;
        }

        return null;
      },
      isBlocked(number) {
        return storage.isBlocked(number);
      },

    };
  })();
  
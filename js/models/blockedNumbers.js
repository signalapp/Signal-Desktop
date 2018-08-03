/* global storage, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  storage.isBlocked = number => {
    const numbers = storage.get('blocked', []);

    return _.include(numbers, number);
  };
  storage.addBlockedNumber = number => {
    const numbers = storage.get('blocked', []);
    if (_.include(numbers, number)) {
      return;
    }

    window.log.info('adding', number, 'to blocked list');
    storage.put('blocked', numbers.concat(number));
  };
  storage.removeBlockedNumber = number => {
    const numbers = storage.get('blocked', []);
    if (!_.include(numbers, number)) {
      return;
    }

    window.log.info('removing', number, 'from blocked list');
    storage.put('blocked', _.without(numbers, number));
  };
})();

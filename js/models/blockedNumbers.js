/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    storage.isBlocked = function(number) {
        var numbers = storage.get('blocked', []);

        return _.include(numbers, number);
    };
    storage.addBlockedNumber = function(number) {
        var numbers = storage.get('blocked', []);
        if (_.include(numbers, number)) {
          return;
        }

        console.log('adding', number, 'to blocked list');
        storage.put('blocked', numbers.concat(number));
    };
    storage.removeBlockedNumber = function(number) {
        var numbers = storage.get('blocked', []);
        if (!_.include(numbers, number)) {
          return;
        }

        console.log('removing', number, 'from blocked list');
        storage.put('blocked', _.without(numbers, number));
    };
})();

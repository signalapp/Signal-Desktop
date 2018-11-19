/* global storage, _ */
/* global _: false */
/* global Backbone: false */

/* global BlockedNumberController: false */
/* global storage: false */
/* global Whisper: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const BLOCKED_NUMBERS_ID = 'blocked';
  const BLOCKED_GROUPS_ID = 'blocked-groups';

  storage.isBlocked = number => {
    const numbers = storage.get(BLOCKED_NUMBERS_ID, []);

    return _.include(numbers, number);
  };
  storage.getBlockedNumbers = () => storage.get(BLOCKED_NUMBERS_ID, []);
  storage.addBlockedNumber = number => {
    const numbers = storage.get(BLOCKED_NUMBERS_ID, []);
    if (_.include(numbers, number)) {
      return;
    }

    window.log.info('adding', number, 'to blocked list');
    storage.put(BLOCKED_NUMBERS_ID, numbers.concat(number));
  };
  storage.removeBlockedNumber = number => {
    const numbers = storage.get(BLOCKED_NUMBERS_ID, []);
    if (!_.include(numbers, number)) {
      return;
    }

    window.log.info('removing', number, 'from blocked list');
    storage.put(BLOCKED_NUMBERS_ID, _.without(numbers, number));
  };

  storage.isGroupBlocked = groupId => {
    const groupIds = storage.get(BLOCKED_GROUPS_ID, []);

    return _.include(groupIds, groupId);
  };
  storage.addBlockedGroup = groupId => {
    const groupIds = storage.get(BLOCKED_GROUPS_ID, []);
    if (_.include(groupIds, groupId)) {
      return;
    }

    window.log.info(`adding groupId(${groupId}) to blocked list`);
    storage.put(BLOCKED_GROUPS_ID, groupIds.concat(groupId));
  };
  storage.removeBlockedGroup = groupId => {
    const groupIds = storage.get(BLOCKED_GROUPS_ID, []);
    if (!_.include(groupIds, groupId)) {
      return;
    }

    window.log.info(`removing group(${groupId} from blocked list`);
    storage.put(BLOCKED_GROUPS_ID, _.without(groupIds, groupId));
  };

  Whisper.BlockedNumber = Backbone.Model.extend({
    defaults() {
      return {
        number: '',
      };
    },
    block() {
      return BlockedNumberController.block(this.number);
    },
    unblock() {
      return BlockedNumberController.unblock(this.number);
    },
  });

  Whisper.BlockedNumberCollection = Backbone.Collection.extend({
    model: Whisper.BlockedNumber,
    comparator(m) {
      return m.get('number');
    },
    getNumber(number) {
      return this.models.find(m => m.number === number);
    },
  });

})();
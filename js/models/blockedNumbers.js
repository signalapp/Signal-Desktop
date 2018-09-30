/* global storage, _ */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  const BLOCKED_NUMBERS_ID = 'blocked';
  const BLOCKED_GROUPS_ID = 'blocked-groups';

  storage.isBlocked = number => {
    const numbers = storage.get(BLOCKED_NUMBERS_ID, []);

    return _.include(numbers, number);
  };
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
})();

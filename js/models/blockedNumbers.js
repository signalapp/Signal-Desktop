// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global storage, _ */

// eslint-disable-next-line func-names
(function () {
  const BLOCKED_NUMBERS_ID = 'blocked';
  const BLOCKED_UUIDS_ID = 'blocked-uuids';
  const BLOCKED_GROUPS_ID = 'blocked-groups';

  function getArray(key) {
    const result = storage.get(key, []);

    if (!Array.isArray(result)) {
      window.log.error(
        `Expected storage key ${JSON.stringify(
          key
        )} to contain an array or nothing`
      );
      return [];
    }

    return result;
  }

  storage.getBlockedNumbers = () => getArray(BLOCKED_NUMBERS_ID);
  storage.isBlocked = number => {
    const numbers = storage.getBlockedNumbers();

    return _.include(numbers, number);
  };
  storage.addBlockedNumber = number => {
    const numbers = storage.getBlockedNumbers();
    if (_.include(numbers, number)) {
      return;
    }

    window.log.info('adding', number, 'to blocked list');
    storage.put(BLOCKED_NUMBERS_ID, numbers.concat(number));
  };
  storage.removeBlockedNumber = number => {
    const numbers = storage.getBlockedNumbers();
    if (!_.include(numbers, number)) {
      return;
    }

    window.log.info('removing', number, 'from blocked list');
    storage.put(BLOCKED_NUMBERS_ID, _.without(numbers, number));
  };

  storage.getBlockedUuids = () => getArray(BLOCKED_UUIDS_ID);
  storage.isUuidBlocked = uuid => {
    const uuids = storage.getBlockedUuids();

    return _.include(uuids, uuid);
  };
  storage.addBlockedUuid = uuid => {
    const uuids = storage.getBlockedUuids();
    if (_.include(uuids, uuid)) {
      return;
    }

    window.log.info('adding', uuid, 'to blocked list');
    storage.put(BLOCKED_UUIDS_ID, uuids.concat(uuid));
  };
  storage.removeBlockedUuid = uuid => {
    const numbers = storage.getBlockedUuids();
    if (!_.include(numbers, uuid)) {
      return;
    }

    window.log.info('removing', uuid, 'from blocked list');
    storage.put(BLOCKED_UUIDS_ID, _.without(numbers, uuid));
  };

  storage.getBlockedGroups = () => getArray(BLOCKED_GROUPS_ID);
  storage.isGroupBlocked = groupId => {
    const groupIds = storage.getBlockedGroups();

    return _.include(groupIds, groupId);
  };
  storage.addBlockedGroup = groupId => {
    const groupIds = storage.getBlockedGroups();
    if (_.include(groupIds, groupId)) {
      return;
    }

    window.log.info(`adding group(${groupId}) to blocked list`);
    storage.put(BLOCKED_GROUPS_ID, groupIds.concat(groupId));
  };
  storage.removeBlockedGroup = groupId => {
    const groupIds = storage.getBlockedGroups();
    if (!_.include(groupIds, groupId)) {
      return;
    }

    window.log.info(`removing group(${groupId} from blocked list`);
    storage.put(BLOCKED_GROUPS_ID, _.without(groupIds, groupId));
  };
})();

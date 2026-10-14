// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { isGroupV2 } from './whatTypeOfConversation.dom.ts';
import { areEqual } from '../Bytes.std.ts';
import { isOnline } from '../textsecure/WebAPI.preload.ts';

const log = createLogger('updateProfileKeyForAllGroups');

type UpdateProfileKeyResult =
  | {
      state: 'success';
    }
  | {
      state: 'failed';
      completedGroupIds: Set<string>;
    }
  | {
      state: 'canceled';
    };

export async function updateProfileKeyForAllGroups(
  profileKeyForUpdate: Uint8Array<ArrayBuffer>,
  groupIdsAlreadyCompleted: Set<string>
): Promise<UpdateProfileKeyResult> {
  const ourAci = itemStorage.user.getCheckedAci();
  const ourProfileKey = itemStorage.get('profileKey');

  if (!ourProfileKey || !areEqual(profileKeyForUpdate, ourProfileKey)) {
    log.error('Profile key has changed, canceling run');
    return { state: 'canceled' };
  }

  const groupsToUpdate = window.ConversationController.getAll().filter(
    conversation => {
      const groupId = conversation.get('groupId');

      return (
        isGroupV2(conversation.attributes) &&
        groupId &&
        conversation.isMember(ourAci) &&
        !conversation.get('terminated') &&
        !groupIdsAlreadyCompleted.has(groupId)
      );
    }
  );

  log.info(`About to update ${groupsToUpdate.length} groups`);
  let count = 0;
  let failedCount = 0;

  for (const group of groupsToUpdate) {
    try {
      if (!isOnline()) {
        log.error('We are not online; cannot update groups');
        return {
          state: 'failed',
          completedGroupIds: groupIdsAlreadyCompleted,
        };
      }

      const groupId = group.get('groupId');

      // First, double-check that we still need to update the group
      if (!groupId || !group.isMember(ourAci) || group.get('terminated')) {
        log.warn(`Group ${group.idForLogging()} no longer needs an update`);
        continue;
      }

      const ourProfileKeyInLoop = itemStorage.get('profileKey');
      if (
        !ourProfileKeyInLoop ||
        !areEqual(profileKeyForUpdate, ourProfileKeyInLoop)
      ) {
        log.error('Profile key has changed in the loop, canceling run');
        return { state: 'canceled' };
      }

      // oxlint-disable-next-line no-await-in-loop
      await group.updateProfileKey();

      groupIdsAlreadyCompleted.add(groupId);
      count += 1;
    } catch (error) {
      log.error(
        `Failed to update group ${group.idForLogging()}`,
        toLogFormat(error)
      );
      failedCount += 1;
    }
  }

  if (failedCount > 0) {
    log.info(
      `Failure! Updated ${count} groups, failed to update ${failedCount} groups`
    );
    return {
      state: 'failed',
      completedGroupIds: groupIdsAlreadyCompleted,
    };
  }

  log.info(`Success! Updated ${count} groups.`);
  return { state: 'success' };
}

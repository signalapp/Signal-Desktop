// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { areEqual } from '../Bytes.std.ts';
import { isOnline } from '../textsecure/WebAPI.preload.ts';
import { isGroupV2 } from './whatTypeOfConversation.dom.ts';
import { isMember } from './groupMembershipUtils.preload.ts';
import { isBlocked } from './isBlocked.preload.ts';
import type { ConversationAttributesType } from '../model-types.std.ts';
import type { AciString } from '../types/ServiceId.std.ts';

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

function shouldShareProfileKeyWithGroup(
  attributes: ConversationAttributesType,
  ourAci: AciString
): boolean {
  return (
    isGroupV2(attributes) &&
    isMember(attributes, ourAci) &&
    !attributes.terminated &&
    Boolean(attributes.profileSharing) &&
    !isBlocked(attributes)
  );
}

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
        groupId &&
        shouldShareProfileKeyWithGroup(conversation.attributes, ourAci) &&
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
      if (
        !groupId ||
        !shouldShareProfileKeyWithGroup(group.attributes, ourAci)
      ) {
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

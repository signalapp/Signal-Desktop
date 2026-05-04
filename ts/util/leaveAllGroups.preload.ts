// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { isGroupV2 } from './whatTypeOfConversation.dom.ts';

const log = createLogger('AccountManager');

export async function leaveAllGroups(): Promise<void> {
  const ourServiceId = itemStorage.user.getCheckedAci();

  const groupsToLeave = window.ConversationController.getAll().filter(
    conversation => {
      return (
        isGroupV2(conversation.attributes) &&
        conversation.isMember(ourServiceId) &&
        !conversation.attributes.terminated
      );
    }
  );

  log.info(`About to leave ${groupsToLeave.length} groups`);
  let count = 0;

  for (const group of groupsToLeave) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      await group.leaveGroupV2();
      count += 1;
    } catch (error) {
      log.error(
        `Failed to leave group ${group.idForLogging()}`,
        toLogFormat(error)
      );
    }
  }

  log.info(`Left ${count} groups`);
}

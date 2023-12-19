// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { SignalService as Proto } from '../protobuf';
import type { ServiceIdString } from '../types/ServiceId';
import * as log from '../logging/log';
import { getConversationIdForLogging } from './idForLogging';
import { isMemberPending } from './groupMembershipUtils';
import { isNotNil } from './isNotNil';

export async function removePendingMember(
  conversationAttributes: ConversationAttributesType,
  serviceIds: ReadonlyArray<ServiceIdString>
): Promise<Proto.GroupChange.Actions | undefined> {
  const idLog = getConversationIdForLogging(conversationAttributes);

  const pendingServiceIds = serviceIds
    .map(uuid => {
      // This user's pending state may have changed in the time between the user's
      //   button press and when we get here. It's especially important to check here
      //   in conflict/retry cases.
      if (!isMemberPending(conversationAttributes, uuid)) {
        log.warn(
          `removePendingMember/${idLog}: ${uuid} is not a pending member of group. Returning early.`
        );
        return undefined;
      }

      return uuid;
    })
    .filter(isNotNil);

  if (!pendingServiceIds.length) {
    return undefined;
  }

  return window.Signal.Groups.buildDeletePendingMemberChange({
    group: conversationAttributes,
    serviceIds: pendingServiceIds,
  });
}

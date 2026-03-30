// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { SignalService as Proto } from '../protobuf/index.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import { buildDeletePendingMemberChange } from '../groups.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { getConversationIdForLogging } from './idForLogging.preload.ts';
import { isMemberPending } from './groupMembershipUtils.preload.ts';
import { isNotNil } from './isNotNil.std.ts';

const log = createLogger('removePendingMember');

export async function removePendingMember(
  conversationAttributes: ConversationAttributesType,
  serviceIds: ReadonlyArray<ServiceIdString>
): Promise<Proto.GroupChange.Actions.Params | undefined> {
  const idLog = getConversationIdForLogging(conversationAttributes);

  const pendingServiceIds = serviceIds
    .map(uuid => {
      // This user's pending state may have changed in the time between the user's
      //   button press and when we get here. It's especially important to check here
      //   in conflict/retry cases.
      if (!isMemberPending(conversationAttributes, uuid)) {
        log.warn(
          `${idLog}: ${uuid} is not a pending member of group. Returning early.`
        );
        return undefined;
      }

      return uuid;
    })
    .filter(isNotNil);

  if (!pendingServiceIds.length) {
    return undefined;
  }

  return buildDeletePendingMemberChange({
    group: conversationAttributes,
    serviceIds: pendingServiceIds,
  });
}

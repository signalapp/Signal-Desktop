// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { SignalService as Proto } from '../protobuf/index.std.js';
import type { AciString } from '../types/ServiceId.std.js';
import { createLogger } from '../logging/log.std.js';
import { buildDeletePendingAdminApprovalMemberChange } from '../groups.preload.js';
import { getConversationIdForLogging } from './idForLogging.preload.js';
import { isMemberRequestingToJoin } from './groupMembershipUtils.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('denyPendingApprovalRequest');

export async function denyPendingApprovalRequest(
  conversationAttributes: ConversationAttributesType,
  aci: AciString
): Promise<Proto.GroupChange.Actions | undefined> {
  const idLog = getConversationIdForLogging(conversationAttributes);

  // This user's pending state may have changed in the time between the user's
  //   button press and when we get here. It's especially important to check here
  //   in conflict/retry cases.
  if (!isMemberRequestingToJoin(conversationAttributes, aci)) {
    log.warn(
      `${idLog}: ${aci} is not requesting ` +
        'to join the group. Returning early.'
    );
    return undefined;
  }

  const ourAci = itemStorage.user.getCheckedAci();

  return buildDeletePendingAdminApprovalMemberChange({
    group: conversationAttributes,
    ourAci,
    aci,
  });
}

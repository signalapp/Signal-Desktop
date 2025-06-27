// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { SignalService as Proto } from '../protobuf';
import type { AciString } from '../types/ServiceId';
import { createLogger } from '../logging/log';
import { getConversationIdForLogging } from './idForLogging';
import { isMemberRequestingToJoin } from './groupMembershipUtils';

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

  const ourAci = window.textsecure.storage.user.getCheckedAci();

  return window.Signal.Groups.buildDeletePendingAdminApprovalMemberChange({
    group: conversationAttributes,
    ourAci,
    aci,
  });
}

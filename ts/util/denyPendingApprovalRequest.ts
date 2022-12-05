// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { SignalService as Proto } from '../protobuf';
import type { UUID } from '../types/UUID';
import * as log from '../logging/log';
import { UUIDKind } from '../types/UUID';
import { getConversationIdForLogging } from './idForLogging';
import { isMemberRequestingToJoin } from './isMemberRequestingToJoin';

export async function denyPendingApprovalRequest(
  conversationAttributes: ConversationAttributesType,
  uuid: UUID
): Promise<Proto.GroupChange.Actions | undefined> {
  const idLog = getConversationIdForLogging(conversationAttributes);

  // This user's pending state may have changed in the time between the user's
  //   button press and when we get here. It's especially important to check here
  //   in conflict/retry cases.
  if (!isMemberRequestingToJoin(conversationAttributes, uuid)) {
    log.warn(
      `denyPendingApprovalRequest/${idLog}: ${uuid} is not requesting ` +
        'to join the group. Returning early.'
    );
    return undefined;
  }

  const ourUuid = window.textsecure.storage.user.getCheckedUuid(UUIDKind.ACI);

  return window.Signal.Groups.buildDeletePendingAdminApprovalMemberChange({
    group: conversationAttributes,
    ourUuid,
    uuid,
  });
}

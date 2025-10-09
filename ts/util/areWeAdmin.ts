// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.js';
import { SignalService as Proto } from '../protobuf/index.js';
import { isGroupV2 } from './whatTypeOfConversation.js';
import { itemStorage } from '../textsecure/Storage.js';

export function areWeAdmin(
  attributes: Pick<
    ConversationAttributesType,
    'groupId' | 'groupVersion' | 'membersV2'
  >
): boolean {
  if (!isGroupV2(attributes)) {
    return false;
  }

  const memberEnum = Proto.Member.Role;
  const members = attributes.membersV2 || [];
  const ourAci = itemStorage.user.getAci();
  const me = members.find(item => item.aci === ourAci);
  if (!me) {
    return false;
  }

  return me.role === memberEnum.ADMINISTRATOR;
}

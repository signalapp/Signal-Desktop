// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AvatarDataType } from '../types/Avatar';
import { getDefaultAvatars } from '../types/Avatar';
import { isDirectConversation } from './whatTypeOfConversation';
import type { ConversationAttributesType } from '../model-types.d';

export function getAvatarData(
  conversationAttrs: Pick<ConversationAttributesType, 'avatars' | 'type'>
): Array<AvatarDataType> {
  const { avatars } = conversationAttrs;

  if (avatars && avatars.length) {
    return avatars;
  }

  const isGroup = !isDirectConversation(conversationAttrs);

  return getDefaultAvatars(isGroup);
}

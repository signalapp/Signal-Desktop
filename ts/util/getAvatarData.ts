// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AvatarDataType } from '../types/Avatar.js';
import { getDefaultAvatars } from '../types/Avatar.js';
import { isDirectConversation } from './whatTypeOfConversation.js';
import type { ConversationAttributesType } from '../model-types.d.ts';

export function getAvatarData(
  conversationAttrs: Pick<ConversationAttributesType, 'avatars' | 'type'>
): ReadonlyArray<AvatarDataType> {
  const { avatars } = conversationAttrs;

  if (avatars && avatars.length) {
    return avatars;
  }

  const isGroup = !isDirectConversation(conversationAttrs);

  return getDefaultAvatars(isGroup);
}

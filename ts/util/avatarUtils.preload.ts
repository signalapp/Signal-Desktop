// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import type { ContactAvatarType } from '../types/Avatar.std.js';
import { isMe } from './whatTypeOfConversation.dom.js';
import { isSignalConversation } from './isSignalConversation.dom.js';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.js';
import { getAbsoluteAttachmentPath } from './migrations.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export function hasAvatar(
  conversationAttrs: ConversationAttributesType
): boolean {
  return Boolean(
    getAvatar(conversationAttrs) || conversationAttrs.remoteAvatarUrl
  );
}

export function getAvatarHash(
  conversationAttrs: ConversationAttributesType
): undefined | string {
  const avatar = isMe(conversationAttrs)
    ? conversationAttrs.profileAvatar || conversationAttrs.avatar
    : conversationAttrs.avatar || conversationAttrs.profileAvatar;
  return avatar?.hash || undefined;
}

export function getAvatar(
  conversationAttrs: ConversationAttributesType
): undefined | ContactAvatarType {
  const shouldShowProfileAvatar =
    isMe(conversationAttrs) ||
    itemStorage.get('preferContactAvatars') === false;
  const avatar = shouldShowProfileAvatar
    ? conversationAttrs.profileAvatar || conversationAttrs.avatar
    : conversationAttrs.avatar || conversationAttrs.profileAvatar;
  return avatar || undefined;
}

export function getLocalAvatarUrl(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const avatar = getAvatar(conversationAttrs);
  if (!avatar) {
    return undefined;
  }

  if (isSignalConversation(conversationAttrs)) {
    return avatar.path;
  }
  return avatar.path ? getLocalAttachmentUrl(avatar) : undefined;
}

// Used only for ts/services/writeProfile.ts
export function getRawAvatarPath(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const avatar = getAvatar(conversationAttrs);
  if (!avatar?.path) {
    return undefined;
  }

  if (isSignalConversation(conversationAttrs)) {
    return avatar.path;
  }

  return getAbsoluteAttachmentPath(avatar.path);
}

export function getLocalProfileAvatarUrl(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const avatar = conversationAttrs.profileAvatar || conversationAttrs.avatar;
  return avatar?.path ? getLocalAttachmentUrl(avatar) : undefined;
}

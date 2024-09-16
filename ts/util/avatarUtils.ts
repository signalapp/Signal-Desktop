// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ContactAvatarType } from '../types/Avatar';
import { isMe } from './whatTypeOfConversation';
import { isSignalConversation } from './isSignalConversation';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl';

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
    window.storage.get('preferContactAvatars') === false;
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

  const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
  return getAbsoluteAttachmentPath(avatar.path);
}

export function getLocalProfileAvatarUrl(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const avatar = conversationAttrs.profileAvatar || conversationAttrs.avatar;
  return avatar?.path ? getLocalAttachmentUrl(avatar) : undefined;
}

export function getLocalUnblurredAvatarUrl(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const { unblurredAvatarPath, unblurredAvatarUrl } = conversationAttrs;
  if (unblurredAvatarUrl != null) {
    return unblurredAvatarUrl;
  }

  if (unblurredAvatarPath == null) {
    return undefined;
  }

  // Compatibility mode
  const avatar = getAvatar(conversationAttrs);

  // Since we use `unblurredAvatarUrl` only for equality checks - if the path
  // is the same - return equivalent url
  if (avatar?.path === unblurredAvatarPath) {
    return getLocalAvatarUrl(conversationAttrs);
  }

  // Otherwise generate some valid url, but it will never be the same because of
  // absent "size".
  return getLocalAttachmentUrl({ path: unblurredAvatarPath });
}

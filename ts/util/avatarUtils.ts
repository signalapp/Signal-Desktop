// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import { isMe } from './whatTypeOfConversation';
import { isSignalConversation } from './isSignalConversation';

export function getAvatarHash(
  conversationAttrs: ConversationAttributesType
): undefined | string {
  const avatar = isMe(conversationAttrs)
    ? conversationAttrs.profileAvatar || conversationAttrs.avatar
    : conversationAttrs.avatar || conversationAttrs.profileAvatar;
  return avatar?.hash || undefined;
}

export function getAvatarPath(
  conversationAttrs: ConversationAttributesType
): undefined | string {
  const shouldShowProfileAvatar =
    isMe(conversationAttrs) ||
    window.storage.get('preferContactAvatars') === false;
  const avatar = shouldShowProfileAvatar
    ? conversationAttrs.profileAvatar || conversationAttrs.avatar
    : conversationAttrs.avatar || conversationAttrs.profileAvatar;
  return avatar?.path || undefined;
}

export function getAbsoluteAvatarPath(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
  const avatarPath = getAvatarPath(conversationAttrs);
  if (isSignalConversation(conversationAttrs)) {
    return avatarPath;
  }
  return avatarPath ? getAbsoluteAttachmentPath(avatarPath) : undefined;
}

export function getAbsoluteProfileAvatarPath(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
  const avatarPath = conversationAttrs.profileAvatar?.path;
  return avatarPath ? getAbsoluteAttachmentPath(avatarPath) : undefined;
}

export function getAbsoluteUnblurredAvatarPath(
  conversationAttrs: ConversationAttributesType
): string | undefined {
  const { getAbsoluteAttachmentPath } = window.Signal.Migrations;
  const { unblurredAvatarPath } = conversationAttrs;
  return unblurredAvatarPath
    ? getAbsoluteAttachmentPath(unblurredAvatarPath)
    : undefined;
}

// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

export function getExternalAvatarFilesForConversation(
  conversation: Pick<ConversationAttributesType, 'avatar' | 'profileAvatar'>
): Array<string> {
  const { avatar, profileAvatar } = conversation;
  const files: Array<string> = [];

  if (avatar && avatar.path) {
    files.push(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    files.push(profileAvatar.path);
  }

  return files;
}

export function getExternalAvatarDraftsForConversation(
  conversation: Pick<ConversationAttributesType, 'avatars'>
): Array<string> {
  const { avatars } = conversation;
  const files: Array<string> = [];

  (avatars || []).forEach(item => {
    if (item.imagePath) {
      files.push(item.imagePath);
    }
  });

  return files;
}

export function getExternalDraftFilesForConversation(
  conversation: Pick<ConversationAttributesType, 'draftAttachments'>
): Array<string> {
  const draftAttachments = conversation.draftAttachments || [];
  const files: Array<string> = [];

  (draftAttachments || []).forEach(attachment => {
    if (attachment.pending) {
      return;
    }

    const { path: file, screenshotPath } = attachment;
    if (file) {
      files.push(file);
    }

    if (screenshotPath) {
      files.push(screenshotPath);
    }
  });

  return files;
}

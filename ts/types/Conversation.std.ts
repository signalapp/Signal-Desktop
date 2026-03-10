// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';

export async function deleteExternalFiles(
  conversation: ConversationAttributesType,
  {
    maybeDeleteAttachmentFile,
  }: {
    maybeDeleteAttachmentFile: (
      path: string
    ) => Promise<{ wasDeleted: boolean }>;
  }
): Promise<void> {
  if (!conversation) {
    return;
  }

  const { avatar, profileAvatar } = conversation;

  if (avatar && avatar.path) {
    await maybeDeleteAttachmentFile(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    await maybeDeleteAttachmentFile(profileAvatar.path);
  }
}

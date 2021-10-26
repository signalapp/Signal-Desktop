// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../Crypto';
import type { ConversationAttributesType } from '../model-types.d';

export type BuildAvatarUpdaterOptions = Readonly<{
  deleteAttachmentData: (path: string) => Promise<void>;
  doesAttachmentExist: (path: string) => Promise<boolean>;
  writeNewAttachmentData: (data: Uint8Array) => Promise<string>;
}>;

function buildAvatarUpdater({ field }: { field: 'avatar' | 'profileAvatar' }) {
  return async (
    conversation: Readonly<ConversationAttributesType>,
    data: Uint8Array,
    {
      deleteAttachmentData,
      doesAttachmentExist,
      writeNewAttachmentData,
    }: BuildAvatarUpdaterOptions
  ): Promise<ConversationAttributesType> => {
    if (!conversation) {
      return conversation;
    }

    const avatar = conversation[field];

    const newHash = computeHash(data);

    if (!avatar || !avatar.hash) {
      return {
        ...conversation,
        [field]: {
          hash: newHash,
          path: await writeNewAttachmentData(data),
        },
      };
    }

    const { hash, path } = avatar;
    const exists = await doesAttachmentExist(path);
    if (!exists) {
      window.SignalContext.log.warn(
        `Conversation.buildAvatarUpdater: attachment ${path} did not exist`
      );
    }

    if (exists && hash === newHash) {
      return conversation;
    }

    await deleteAttachmentData(path);

    return {
      ...conversation,
      [field]: {
        hash: newHash,
        path: await writeNewAttachmentData(data),
      },
    };
  };
}

export const maybeUpdateAvatar = buildAvatarUpdater({ field: 'avatar' });
export const maybeUpdateProfileAvatar = buildAvatarUpdater({
  field: 'profileAvatar',
});

export async function deleteExternalFiles(
  conversation: ConversationAttributesType,
  {
    deleteAttachmentData,
  }: Pick<BuildAvatarUpdaterOptions, 'deleteAttachmentData'>
): Promise<void> {
  if (!conversation) {
    return;
  }

  const { avatar, profileAvatar } = conversation;

  if (avatar && avatar.path) {
    await deleteAttachmentData(avatar.path);
  }

  if (profileAvatar && profileAvatar.path) {
    await deleteAttachmentData(profileAvatar.path);
  }
}

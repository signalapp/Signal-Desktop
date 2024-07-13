// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d';
import type { ContactAvatarType } from './Avatar';
import type { LocalAttachmentV2Type } from './Attachment';
import { computeHash } from '../Crypto';

export type BuildAvatarUpdaterOptions = Readonly<{
  data?: Uint8Array;
  newAvatar?: ContactAvatarType;
  deleteAttachmentData: (path: string) => Promise<void>;
  doesAttachmentExist: (path: string) => Promise<boolean>;
  writeNewAttachmentData: (data: Uint8Array) => Promise<LocalAttachmentV2Type>;
}>;

// This function is ready to handle raw avatar data as well as an avatar which has
//   already been downloaded to disk.
// Scenarios that go to disk today:
//   - During a contact sync (see ContactsParser.ts)
// Scenarios that stay in memory today:
//   - models/Conversations/setProfileAvatar
function buildAvatarUpdater({ field }: { field: 'avatar' | 'profileAvatar' }) {
  return async (
    conversation: Readonly<ConversationAttributesType>,
    {
      data,
      newAvatar,
      deleteAttachmentData,
      doesAttachmentExist,
      writeNewAttachmentData,
    }: BuildAvatarUpdaterOptions
  ): Promise<ConversationAttributesType> => {
    if (!conversation || (!data && !newAvatar)) {
      return conversation;
    }

    const oldAvatar = conversation[field];
    const newHash = data ? computeHash(data) : undefined;

    if (!oldAvatar || !oldAvatar.hash) {
      if (newAvatar) {
        return {
          ...conversation,
          [field]: newAvatar,
        };
      }
      if (data) {
        return {
          ...conversation,
          [field]: {
            hash: newHash,
            ...(await writeNewAttachmentData(data)),
          },
        };
      }
      throw new Error('buildAvatarUpdater: neither newAvatar or newData');
    }

    const { hash, path } = oldAvatar;
    const exists = path && (await doesAttachmentExist(path));
    if (!exists) {
      window.SignalContext.log.warn(
        `Conversation.buildAvatarUpdater: attachment ${path} did not exist`
      );
    }

    if (exists) {
      if (newAvatar && hash && hash === newAvatar.hash) {
        if (newAvatar.path) {
          await deleteAttachmentData(newAvatar.path);
        }
        return conversation;
      }
      if (data && hash && hash === newHash) {
        return conversation;
      }
    }

    if (path) {
      await deleteAttachmentData(path);
    }

    if (newAvatar) {
      return {
        ...conversation,
        [field]: newAvatar,
      };
    }
    if (data) {
      return {
        ...conversation,
        [field]: {
          hash: newHash,
          ...(await writeNewAttachmentData(data)),
        },
      };
    }

    throw new Error('buildAvatarUpdater: neither newAvatar or newData');
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

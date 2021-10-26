// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import dataInterface from '../sql/Client';
import type { ConversationType } from '../state/ducks/conversations';
import { computeHash } from '../Crypto';
import { encryptProfileData } from '../util/encryptProfileData';
import { getProfile } from '../util/getProfile';
import { handleMessageSend } from '../util/handleMessageSend';

export async function writeProfile(
  conversation: ConversationType,
  avatarBuffer?: Uint8Array
): Promise<void> {
  // Before we write anything we request the user's profile so that we can
  // have an up-to-date paymentAddress to be able to include it when we write
  const model = window.ConversationController.get(conversation.id);
  if (!model) {
    return;
  }
  await getProfile(model.get('uuid'), model.get('e164'));

  // Encrypt the profile data, update profile, and if needed upload the avatar
  const {
    aboutEmoji,
    aboutText,
    avatarHash,
    avatarPath,
    familyName,
    firstName,
  } = conversation;

  const [profileData, encryptedAvatarData] = await encryptProfileData(
    conversation,
    avatarBuffer
  );
  const avatarRequestHeaders = await window.textsecure.messaging.putProfile(
    profileData
  );

  // Upload the avatar if provided
  // delete existing files on disk if avatar has been removed
  // update the account's avatar path and hash if it's a new avatar
  let profileAvatar:
    | {
        hash: string;
        path: string;
      }
    | undefined;
  if (avatarRequestHeaders && encryptedAvatarData && avatarBuffer) {
    await window.textsecure.messaging.uploadAvatar(
      avatarRequestHeaders,
      encryptedAvatarData
    );

    const hash = await computeHash(avatarBuffer);

    if (hash !== avatarHash) {
      const [path] = await Promise.all([
        window.Signal.Migrations.writeNewAttachmentData(avatarBuffer),
        avatarPath
          ? window.Signal.Migrations.deleteAttachmentData(avatarPath)
          : undefined,
      ]);
      profileAvatar = {
        hash,
        path,
      };
    }
  } else if (avatarPath) {
    await window.Signal.Migrations.deleteAttachmentData(avatarPath);
  }

  const profileAvatarData = profileAvatar ? { profileAvatar } : {};

  // Update backbone, update DB, run storage service upload
  model.set({
    about: aboutText,
    aboutEmoji,
    profileName: firstName,
    profileFamilyName: familyName,
    ...profileAvatarData,
  });

  dataInterface.updateConversation(model.attributes);
  model.captureChange('writeProfile');

  await handleMessageSend(
    window.textsecure.messaging.sendFetchLocalProfileSyncMessage(),
    { messageIds: [], sendType: 'otherSync' }
  );
}

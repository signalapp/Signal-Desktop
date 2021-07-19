// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../Crypto';
import dataInterface from '../sql/Client';
import { ConversationType } from '../state/ducks/conversations';
import { encryptProfileData } from '../util/encryptProfileData';

export async function writeProfile(
  conversation: ConversationType,
  avatarData?: ArrayBuffer
): Promise<void> {
  // Before we write anything we request the user's profile so that we can
  // have an up-to-date paymentAddress to be able to include it when we write
  const model = window.ConversationController.get(conversation.id);
  if (!model) {
    return;
  }
  await model.getProfile(model.get('uuid'), model.get('e164'));

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
    avatarData
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
  if (avatarRequestHeaders && encryptedAvatarData && avatarData) {
    await window.textsecure.messaging.uploadAvatar(
      avatarRequestHeaders,
      encryptedAvatarData
    );

    const hash = await computeHash(avatarData);

    if (hash !== avatarHash) {
      const [path] = await Promise.all([
        window.Signal.Migrations.writeNewAttachmentData(avatarData),
        avatarPath
          ? window.Signal.Migrations.deleteAttachmentData(avatarPath)
          : undefined,
      ]);
      profileAvatar = {
        hash,
        path,
      };
    } else {
      profileAvatar = {
        hash: String(avatarHash),
        path: String(avatarPath),
      };
    }
  } else if (avatarPath) {
    await window.Signal.Migrations.deleteAttachmentData(avatarPath);
  }

  // Update backbone, update DB, run storage service upload
  model.set({
    about: aboutText,
    aboutEmoji,
    profileAvatar,
    profileName: firstName,
    profileFamilyName: familyName,
  });

  dataInterface.updateConversation(model.attributes);
  model.captureChange('writeProfile');
}

// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import dataInterface from '../sql/Client';
import type { ConversationType } from '../state/ducks/conversations';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { computeHash } from '../Crypto';
import { encryptProfileData } from '../util/encryptProfileData';
import { getProfile } from '../util/getProfile';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import { strictAssert } from '../util/assert';
import { isWhitespace } from '../util/whitespaceStringUtil';
import type { AvatarUpdateType } from '../types/Avatar';
import MessageSender from '../textsecure/SendMessage';

export async function writeProfile(
  conversation: ConversationType,
  avatar: AvatarUpdateType
): Promise<void> {
  const { messaging } = window.textsecure;
  if (!messaging) {
    throw new Error('messaging is not available!');
  }

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

  strictAssert(
    !isWhitespace(String(conversation.firstName)),
    'writeProfile: Cannot set an empty profile name'
  );

  const [profileData, encryptedAvatarData] = await encryptProfileData(
    conversation,
    avatar
  );
  const avatarRequestHeaders = await messaging.putProfile(profileData);

  // Upload the avatar if provided
  // delete existing files on disk if avatar has been removed
  // update the account's avatar path and hash if it's a new avatar
  const { newAvatar } = avatar;
  let maybeProfileAvatarUpdate: {
    profileAvatar?:
      | {
          hash: string;
          path: string;
        }
      | undefined;
  } = {};
  if (profileData.sameAvatar) {
    log.info('writeProfile: not updating avatar');
  } else if (avatarRequestHeaders && encryptedAvatarData && newAvatar) {
    log.info('writeProfile: uploading new avatar');
    const avatarUrl = await messaging.uploadAvatar(
      avatarRequestHeaders,
      encryptedAvatarData
    );

    const hash = await computeHash(newAvatar);

    if (hash !== avatarHash) {
      log.info('writeProfile: removing old avatar and saving the new one');
      const [path] = await Promise.all([
        window.Signal.Migrations.writeNewAttachmentData(newAvatar),
        avatarPath
          ? window.Signal.Migrations.deleteAttachmentData(avatarPath)
          : undefined,
      ]);
      maybeProfileAvatarUpdate = {
        profileAvatar: { hash, path },
      };
    }

    await window.storage.put('avatarUrl', avatarUrl);
  } else if (avatarPath) {
    log.info('writeProfile: removing avatar');
    await Promise.all([
      window.Signal.Migrations.deleteAttachmentData(avatarPath),
      window.storage.put('avatarUrl', undefined),
    ]);

    maybeProfileAvatarUpdate = { profileAvatar: undefined };
  }

  // Update backbone, update DB, run storage service upload
  model.set({
    about: aboutText,
    aboutEmoji,
    profileName: firstName,
    profileFamilyName: familyName,
    ...maybeProfileAvatarUpdate,
  });

  dataInterface.updateConversation(model.attributes);
  model.captureChange('writeProfile');

  try {
    await singleProtoJobQueue.add(
      MessageSender.getFetchLocalProfileSyncMessage()
    );
  } catch (error) {
    log.error(
      'writeProfile: Failed to queue sync message',
      Errors.toLogFormat(error)
    );
  }
}

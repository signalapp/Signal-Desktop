// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataWriter } from '../sql/Client';
import type { ConversationType } from '../state/ducks/conversations';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { computeHash } from '../Crypto';
import { encryptProfileData } from '../util/encryptProfileData';
import { getProfile } from '../util/getProfile';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import { strictAssert } from '../util/assert';
import { isWhitespace } from '../util/whitespaceStringUtil';
import { imagePathToBytes } from '../util/imagePathToBytes';
import { getLocalAvatarUrl } from '../util/avatarUtils';
import type {
  AvatarUpdateOptionsType,
  AvatarUpdateType,
} from '../types/Avatar';
import MessageSender from '../textsecure/SendMessage';

export async function writeProfile(
  conversation: ConversationType,
  options: AvatarUpdateOptionsType
): Promise<void> {
  const { server } = window.textsecure;
  if (!server) {
    throw new Error('server is not available!');
  }

  // Before we write anything we request the user's profile so that we can
  // have an up-to-date paymentAddress to be able to include it when we write
  const model = window.ConversationController.get(conversation.id);
  if (!model) {
    return;
  }
  await getProfile({
    serviceId: model.getServiceId() ?? null,
    e164: model.get('e164') ?? null,
    groupId: null,
  });

  // Encrypt the profile data, update profile, and if needed upload the avatar
  const {
    aboutEmoji,
    aboutText,
    avatarHash,
    rawAvatarPath,
    familyName,
    firstName,
  } = conversation;

  strictAssert(
    !isWhitespace(String(conversation.firstName)),
    'writeProfile: Cannot set an empty profile name'
  );

  let avatarUpdate: AvatarUpdateType;
  if (options.keepAvatar) {
    const profileAvatarUrl = getLocalAvatarUrl(model.attributes);

    let avatarBuffer: Uint8Array | undefined;
    if (profileAvatarUrl) {
      try {
        avatarBuffer = await imagePathToBytes(profileAvatarUrl);
      } catch (error) {
        log.warn('writeProfile: local avatar not found, dropping remote');
      }
    }

    avatarUpdate = {
      oldAvatar: avatarBuffer,
      newAvatar: avatarBuffer,
    };
  } else {
    avatarUpdate = options.avatarUpdate;
  }

  const [profileData, encryptedAvatarData] = await encryptProfileData(
    conversation,
    avatarUpdate
  );
  const avatarRequestHeaders = await server.putProfile(profileData);

  // Upload the avatar if provided
  // delete existing files on disk if avatar has been removed
  // update the account's avatar path and hash if it's a new avatar
  const { newAvatar } = avatarUpdate;
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
    const avatarUrl = await server.uploadAvatar(
      avatarRequestHeaders,
      encryptedAvatarData
    );

    const hash = await computeHash(newAvatar);

    if (hash !== avatarHash) {
      log.info('writeProfile: removing old avatar and saving the new one');
      const [local] = await Promise.all([
        window.Signal.Migrations.writeNewAttachmentData(newAvatar),
        rawAvatarPath
          ? window.Signal.Migrations.deleteAttachmentData(rawAvatarPath)
          : undefined,
      ]);
      maybeProfileAvatarUpdate = {
        profileAvatar: { hash, ...local },
      };
    }

    await window.storage.put('avatarUrl', avatarUrl);
  } else if (rawAvatarPath) {
    log.info('writeProfile: removing avatar');
    await Promise.all([
      window.Signal.Migrations.deleteAttachmentData(rawAvatarPath),
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

  await DataWriter.updateConversation(model.attributes);
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

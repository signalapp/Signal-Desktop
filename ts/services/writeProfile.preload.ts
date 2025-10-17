// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataWriter } from '../sql/Client.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { putProfile, uploadAvatar } from '../textsecure/WebAPI.preload.js';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { computeHash } from '../Crypto.node.js';
import { encryptProfileData } from '../util/encryptProfileData.preload.js';
import { getProfile } from '../util/getProfile.preload.js';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue.preload.js';
import { strictAssert } from '../util/assert.std.js';
import {
  writeNewAttachmentData,
  deleteAttachmentData,
} from '../util/migrations.preload.js';
import { isWhitespace } from '../util/whitespaceStringUtil.std.js';
import { imagePathToBytes } from '../util/imagePathToBytes.dom.js';
import { getLocalAvatarUrl } from '../util/avatarUtils.preload.js';
import type {
  AvatarUpdateOptionsType,
  AvatarUpdateType,
} from '../types/Avatar.std.js';
import { MessageSender } from '../textsecure/SendMessage.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('writeProfile');

export async function writeProfile(
  conversation: ConversationType,
  options: AvatarUpdateOptionsType
): Promise<void> {
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
    badges,
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
        log.warn('local avatar not found, dropping remote');
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
  const avatarRequestHeaders = await putProfile(profileData);

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
    log.info('not updating avatar');
  } else if (
    typeof avatarRequestHeaders === 'object' &&
    encryptedAvatarData &&
    newAvatar
  ) {
    log.info('uploading new avatar');
    const avatarUrl = await uploadAvatar(
      avatarRequestHeaders,
      encryptedAvatarData
    );

    const hash = await computeHash(newAvatar);

    if (hash !== avatarHash) {
      log.info('removing old avatar and saving the new one');
      const [local] = await Promise.all([
        writeNewAttachmentData(newAvatar),
        rawAvatarPath ? deleteAttachmentData(rawAvatarPath) : undefined,
      ]);
      maybeProfileAvatarUpdate = {
        profileAvatar: { hash, ...local },
      };
    }

    await itemStorage.put('avatarUrl', avatarUrl);
  } else if (rawAvatarPath) {
    log.info('removing avatar');
    await Promise.all([
      deleteAttachmentData(rawAvatarPath),
      itemStorage.put('avatarUrl', undefined),
    ]);

    maybeProfileAvatarUpdate = { profileAvatar: undefined };
  }

  // Update model, update DB, run storage service upload
  model.set({
    about: aboutText,
    aboutEmoji,
    profileName: firstName,
    profileFamilyName: familyName,
    badges: badges ? [...badges] : undefined,
    ...maybeProfileAvatarUpdate,
  });

  await DataWriter.updateConversation(model.attributes);
  model.captureChange('writeProfile');

  try {
    await singleProtoJobQueue.add(
      MessageSender.getFetchLocalProfileSyncMessage()
    );
  } catch (error) {
    log.error('Failed to queue sync message', Errors.toLogFormat(error));
  }
}

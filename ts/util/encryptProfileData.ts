// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Crypto, { PaddedLengths } from '../textsecure/Crypto';
import { ConversationType } from '../state/ducks/conversations';
import { ProfileRequestDataType } from '../textsecure/WebAPI';
import { assert } from './assert';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  bytesFromString,
} from '../Crypto';
import { deriveProfileKeyCommitment, deriveProfileKeyVersion } from './zkgroup';

const { encryptProfile, encryptProfileItemWithPadding } = Crypto;

export async function encryptProfileData(
  conversation: ConversationType,
  avatarData?: ArrayBuffer
): Promise<[ProfileRequestDataType, ArrayBuffer | undefined]> {
  const {
    aboutEmoji,
    aboutText,
    familyName,
    firstName,
    profileKey,
    uuid,
  } = conversation;

  assert(profileKey, 'profileKey');
  assert(uuid, 'uuid');

  const keyBuffer = base64ToArrayBuffer(profileKey);

  const fullName = [firstName, familyName].filter(Boolean).join('\0');

  const [
    bytesName,
    bytesAbout,
    bytesAboutEmoji,
    encryptedAvatarData,
  ] = await Promise.all([
    encryptProfileItemWithPadding(
      bytesFromString(fullName),
      keyBuffer,
      PaddedLengths.Name
    ),
    aboutText
      ? encryptProfileItemWithPadding(
          bytesFromString(aboutText),
          keyBuffer,
          PaddedLengths.About
        )
      : null,
    aboutEmoji
      ? encryptProfileItemWithPadding(
          bytesFromString(aboutEmoji),
          keyBuffer,
          PaddedLengths.AboutEmoji
        )
      : null,
    avatarData ? encryptProfile(avatarData, keyBuffer) : undefined,
  ]);

  const profileData = {
    version: deriveProfileKeyVersion(profileKey, uuid),
    name: arrayBufferToBase64(bytesName),
    about: bytesAbout ? arrayBufferToBase64(bytesAbout) : null,
    aboutEmoji: bytesAboutEmoji ? arrayBufferToBase64(bytesAboutEmoji) : null,
    paymentAddress: window.storage.get('paymentAddress') || null,
    avatar: Boolean(avatarData),
    commitment: deriveProfileKeyCommitment(profileKey, uuid),
  };

  return [profileData, encryptedAvatarData];
}

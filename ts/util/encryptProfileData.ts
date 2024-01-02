// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationType } from '../state/ducks/conversations';
import type { ProfileRequestDataType } from '../textsecure/WebAPI';
import { assertDev } from './assert';
import * as Bytes from '../Bytes';
import {
  PaddedLengths,
  encryptProfile,
  encryptProfileItemWithPadding,
} from '../Crypto';
import type { AvatarUpdateType } from '../types/Avatar';
import { deriveProfileKeyCommitment, deriveProfileKeyVersion } from './zkgroup';
import { isSharingPhoneNumberWithEverybody } from './phoneNumberSharingMode';

export async function encryptProfileData(
  conversation: ConversationType,
  { oldAvatar, newAvatar }: AvatarUpdateType
): Promise<[ProfileRequestDataType, Uint8Array | undefined]> {
  const {
    aboutEmoji,
    aboutText,
    badges,
    familyName,
    firstName,
    profileKey,
    serviceId,
  } = conversation;

  assertDev(profileKey, 'profileKey');
  assertDev(serviceId, 'serviceId');

  const keyBuffer = Bytes.fromBase64(profileKey);

  const fullName = [firstName, familyName].filter(Boolean).join('\0');

  const bytesName = encryptProfileItemWithPadding(
    Bytes.fromString(fullName),
    keyBuffer,
    PaddedLengths.Name
  );

  const bytesAbout = aboutText
    ? encryptProfileItemWithPadding(
        Bytes.fromString(aboutText),
        keyBuffer,
        PaddedLengths.About
      )
    : null;

  const bytesAboutEmoji = aboutEmoji
    ? encryptProfileItemWithPadding(
        Bytes.fromString(aboutEmoji),
        keyBuffer,
        PaddedLengths.AboutEmoji
      )
    : null;

  const encryptedPhoneNumberSharing = encryptProfile(
    new Uint8Array([isSharingPhoneNumberWithEverybody() ? 1 : 0]),
    keyBuffer
  );

  const encryptedAvatarData = newAvatar
    ? encryptProfile(newAvatar, keyBuffer)
    : undefined;

  const sameAvatar = Bytes.areEqual(oldAvatar, newAvatar);

  const profileData = {
    version: deriveProfileKeyVersion(profileKey, serviceId),
    name: Bytes.toBase64(bytesName),
    about: bytesAbout ? Bytes.toBase64(bytesAbout) : null,
    aboutEmoji: bytesAboutEmoji ? Bytes.toBase64(bytesAboutEmoji) : null,
    badgeIds: (badges || []).map(({ id }) => id),
    paymentAddress: window.storage.get('paymentAddress') || null,
    avatar: Boolean(newAvatar),
    sameAvatar,
    commitment: deriveProfileKeyCommitment(profileKey, serviceId),
    phoneNumberSharing: Bytes.toBase64(encryptedPhoneNumberSharing),
  };

  return [profileData, encryptedAvatarData];
}

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AvatarColorType } from './Colors';
import type { AddressableAttachmentType } from './Attachment';
import { strictAssert } from '../util/assert';

export const PersonalAvatarIcons = [
  'abstract_01',
  'abstract_02',
  'abstract_03',
  'cat',
  'dog',
  'fox',
  'tucan',
  'pig',
  'dinosour',
  'sloth',
  'incognito',
  'ghost',
] as const;

export const GroupAvatarIcons = [
  'balloon',
  'book',
  'briefcase',
  'celebration',
  'drink',
  'football',
  'heart',
  'house',
  'melon',
  'soccerball',
  'sunset',
  'surfboard',
] as const;

export type ContactAvatarType =
  | ({
      // Downloaded avatar
      path: string;
      url?: string;
      hash?: string;
    } & Partial<AddressableAttachmentType>)
  | {
      // Not-yet downloaded avatar
      path?: undefined;
      url: string;
      hash?: string;
    };

type GroupAvatarIconType = (typeof GroupAvatarIcons)[number];

type PersonalAvatarIconType = (typeof PersonalAvatarIcons)[number];

export type AvatarIconType = GroupAvatarIconType | PersonalAvatarIconType;

export type AvatarDataType = {
  id: number | string;
  buffer?: Uint8Array;
  color?: AvatarColorType;
  icon?: AvatarIconType;
  text?: string;
  imagePath?: string;

  // LocalAttachmentV2Type compatibility (except for `path` being `imagePath`)
  version?: 2;
  localKey?: string;
  size?: number;
};

export type DeleteAvatarFromDiskActionType = (
  avatarData: AvatarDataType,
  conversationId?: string
) => unknown;

export type ReplaceAvatarActionType = (
  curr: AvatarDataType,
  prev?: AvatarDataType,
  conversationId?: string
) => unknown;

export type SaveAvatarToDiskActionType = (
  avatarData: AvatarDataType,
  conversationId?: string
) => unknown;

export type AvatarUpdateType = Readonly<{
  oldAvatar: Uint8Array | undefined;
  newAvatar: Uint8Array | undefined;
}>;

export type AvatarUpdateOptionsType = Readonly<
  | {
      keepAvatar: false;
      avatarUpdate: AvatarUpdateType;
    }
  | {
      keepAvatar: true;
    }
>;

const groupIconColors = [
  'A180',
  'A120',
  'A110',
  'A170',
  'A100',
  'A210',
  'A100',
  'A180',
  'A120',
  'A110',
  'A130',
  'A210',
];

const personalIconColors = [
  'A130',
  'A120',
  'A170',
  'A190',
  'A140',
  'A190',
  'A120',
  'A160',
  'A130',
  'A180',
  'A210',
  'A100',
];

strictAssert(
  groupIconColors.length === GroupAvatarIcons.length &&
    personalIconColors.length === PersonalAvatarIcons.length,
  'colors.length !== icons.length'
);

const groupDefaultAvatars = GroupAvatarIcons.map((icon, index) => ({
  id: index,
  color: groupIconColors[index],
  icon,
}));

const personalDefaultAvatars = PersonalAvatarIcons.map((icon, index) => ({
  id: index,
  color: personalIconColors[index],
  icon,
}));

export function getDefaultAvatars(
  isGroup?: boolean
): ReadonlyArray<AvatarDataType> {
  if (isGroup) {
    return groupDefaultAvatars;
  }

  return personalDefaultAvatars;
}

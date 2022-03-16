// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AvatarColorType } from './Colors';
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

type GroupAvatarIconType = typeof GroupAvatarIcons[number];

type PersonalAvatarIconType = typeof PersonalAvatarIcons[number];

export type AvatarIconType = GroupAvatarIconType | PersonalAvatarIconType;

export type AvatarDataType = {
  id: number | string;
  buffer?: Uint8Array;
  color?: AvatarColorType;
  icon?: AvatarIconType;
  imagePath?: string;
  text?: string;
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

export function getDefaultAvatars(isGroup?: boolean): Array<AvatarDataType> {
  if (isGroup) {
    return groupDefaultAvatars;
  }

  return personalDefaultAvatars;
}

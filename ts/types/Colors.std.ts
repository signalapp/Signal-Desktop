// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AxoTokens } from '../axo/AxoTokens.std.js';

export const AvatarColorMap = new Map(
  AxoTokens.Avatar.getAllColorNames().map(colorName => {
    return [colorName, AxoTokens.Avatar.getColorValues(colorName)];
  })
);

export const AvatarColors = AxoTokens.Avatar.getAllColorNames();

export const AVATAR_COLOR_COUNT = AvatarColors.length;

export const ConversationColors = [
  'ultramarine',
  'crimson',
  'vermilion',
  'burlap',
  'forest',
  'wintergreen',
  'teal',
  'blue',
  'indigo',
  'violet',
  'plum',
  'taupe',
  'steel',
  'ember',
  'midnight',
  'infrared',
  'lagoon',
  'fluorescent',
  'basil',
  'sublime',
  'sea',
  'tangerine',
] as const;

export const ContactNameColors = [
  '200',
  '120',
  '300',
  '010',
  '210',
  '330',
  '230',
  '180',
  '030',
  '340',
  '270',
  '090',
  '000',
  '150',
  '240',
  '040',
  '160',
  '280',
  '080',
  '320',
  '020',
  '140',
  '260',
  '060',
  '350',
  '100',
  '290',
  '130',
  '220',
  '050',
  '170',
  '250',
  '070',
  '190',
  '310',
  '110',
];

export type ContactNameColorType = (typeof ContactNameColors)[number];

export type CustomColorType = {
  start: { hue: number; saturation: number; lightness?: number };
  end?: { hue: number; saturation: number; lightness?: number };
  deg?: number;
};

export type AvatarColorType = AxoTokens.Avatar.ColorName;

export type ConversationColorType =
  | (typeof ConversationColors)[number]
  | 'custom';

export type CustomColorDataType = {
  id: string;
  value: CustomColorType;
};

export type DefaultConversationColorType = {
  color: ConversationColorType;
  customColorData?: CustomColorDataType;
};

export const DEFAULT_CONVERSATION_COLOR: DefaultConversationColorType = {
  color: 'ultramarine',
};

export type CustomColorsItemType = {
  readonly colors: Record<string, CustomColorType>;
  readonly version: number;
  readonly order?: ReadonlyArray<string>;
};

export function getAvatarColor(color?: AvatarColorType): AvatarColorType {
  return color || AvatarColors[0];
}

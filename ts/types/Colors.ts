// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const AvatarColors = [
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
  'ultramarine',
] as const;

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
  '150',
  '010',
  '300',
  '210',
  '090',
  '330',
  '230',
  '030',
  '180',
  '340',
  '270',
  '000',
  '120',
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

export type ContactNameColorType = typeof ContactNameColors[number];

export type CustomColorType = {
  start: { hue: number; saturation: number };
  end?: { hue: number; saturation: number };
  deg?: number;
};

export type AvatarColorType = typeof AvatarColors[number];
export type ConversationColorType =
  | typeof ConversationColors[number]
  | 'custom';

// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const AvatarColorMap = new Map([
  [
    'A100',
    {
      bg: '#e3e3fe',
      fg: '#3838f5',
    },
  ],
  [
    'A110',
    {
      bg: '#dde7fc',
      fg: '#1251d3',
    },
  ],
  [
    'A120',
    {
      bg: '#d8e8f0',
      fg: '#086da0',
    },
  ],
  [
    'A130',
    {
      bg: '#cde4cd',
      fg: '#067906',
    },
  ],
  [
    'A140',
    {
      bg: '#eae0fd',
      fg: '#661aff',
    },
  ],
  [
    'A150',
    {
      bg: '#f5e3fe',
      fg: '#9f00f0',
    },
  ],
  [
    'A160',
    {
      bg: '#f6d8ec',
      fg: '#b8057c',
    },
  ],
  [
    'A170',
    {
      bg: '#f5d7d7',
      fg: '#be0404',
    },
  ],
  [
    'A180',
    {
      bg: '#fef5d0',
      fg: '#836b01',
    },
  ],
  [
    'A190',
    {
      bg: '#eae6d5',
      fg: '#7d6f40',
    },
  ],
  [
    'A200',
    {
      bg: '#d2d2dc',
      fg: '#4f4f6d',
    },
  ],
  [
    'A210',
    {
      bg: '#d7d7d9',
      fg: '#5c5c5c',
    },
  ],
]);

export const AvatarColors = Array.from(AvatarColorMap.keys());

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

export type DefaultConversationColorType = {
  color: ConversationColorType;
  customColorData?: {
    id: string;
    value: CustomColorType;
  };
};

export const DEFAULT_CONVERSATION_COLOR: DefaultConversationColorType = {
  color: 'ultramarine',
};

export type CustomColorsItemType = {
  readonly colors: Record<string, CustomColorType>;
  readonly version: number;
};

export function getAvatarColor(color?: AvatarColorType): AvatarColorType {
  return color || AvatarColors[0];
}

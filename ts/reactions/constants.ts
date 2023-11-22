// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES = [
  'heart',
  'thumbsup',
  'thumbsdown',
  'joy',
  'open_mouth',
  'cry',
];

// This is used in storybook for simplicity. Normally we prefer to convert emoji short
// names to actual emoji using convertShortNameToData from components/emoji/lib
// because it takes skin tone into consideration.
export const DEFAULT_PREFERRED_REACTION_EMOJI = [
  '❤️',
  '👍',
  '👎',
  '😂',
  '😮',
  '😢',
];

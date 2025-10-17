// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { EMOJI_PARENT_KEY_CONSTANTS } from '../components/fun/data/emojis.std.js';

export const DEFAULT_PREFERRED_REACTION_EMOJI_PARENT_KEYS = [
  EMOJI_PARENT_KEY_CONSTANTS.RED_HEART,
  EMOJI_PARENT_KEY_CONSTANTS.THUMBS_UP,
  EMOJI_PARENT_KEY_CONSTANTS.THUMBS_DOWN,
  EMOJI_PARENT_KEY_CONSTANTS.FACE_WITH_TEARS_OF_JOY,
  EMOJI_PARENT_KEY_CONSTANTS.FACE_WITH_OPEN_MOUTH,
  EMOJI_PARENT_KEY_CONSTANTS.CRYING_FACE,
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

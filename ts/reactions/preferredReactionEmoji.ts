// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { times } from 'lodash';
import * as log from '../logging/log';
import { DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES } from './constants';
import { convertShortName } from '../components/emoji/lib';
import { isValidReactionEmoji } from './isValidReactionEmoji';

const MAX_STORED_LENGTH = 20;
const MAX_ITEM_LENGTH = 20;

const PREFERRED_REACTION_EMOJI_COUNT =
  DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.length;

export function getPreferredReactionEmoji(
  storedValue: unknown,
  skinTone: number
): Array<string> {
  const storedValueAsArray: Array<unknown> = Array.isArray(storedValue)
    ? storedValue
    : [];

  return times(PREFERRED_REACTION_EMOJI_COUNT, index => {
    const storedItem: unknown = storedValueAsArray[index];
    if (isValidReactionEmoji(storedItem)) {
      return storedItem;
    }

    const fallbackShortName: undefined | string =
      DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES[index];
    if (!fallbackShortName) {
      log.error(
        'Index is out of range. Is the preferred count larger than the list of fallbacks?'
      );
      return '❤️';
    }

    const fallbackEmoji = convertShortName(fallbackShortName, skinTone);
    if (!fallbackEmoji) {
      log.error(
        'No fallback emoji. Does the fallback list contain an invalid short name?'
      );
      return '❤️';
    }

    return fallbackEmoji;
  });
}

export const canBeSynced = (value: unknown): value is Array<string> =>
  Array.isArray(value) &&
  value.length <= MAX_STORED_LENGTH &&
  value.every(
    item => typeof item === 'string' && item.length <= MAX_ITEM_LENGTH
  );

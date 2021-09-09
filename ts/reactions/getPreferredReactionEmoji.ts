// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES } from './constants';
import { convertShortName } from '../components/emoji/lib';
import { isValidReactionEmoji } from './isValidReactionEmoji';

const PREFERRED_REACTION_EMOJI_COUNT =
  DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.length;

export function getPreferredReactionEmoji(
  storedValue: unknown,
  skinTone: number
): Array<string> {
  const isStoredValueValid =
    Array.isArray(storedValue) &&
    storedValue.length === PREFERRED_REACTION_EMOJI_COUNT &&
    storedValue.every(isValidReactionEmoji) &&
    !hasDuplicates(storedValue);
  return isStoredValueValid
    ? storedValue
    : DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.map(shortName =>
        convertShortName(shortName, skinTone)
      );
}

function hasDuplicates(arr: ReadonlyArray<unknown>): boolean {
  return new Set(arr).size !== arr.length;
}

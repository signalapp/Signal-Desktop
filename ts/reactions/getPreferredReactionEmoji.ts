// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DEFAULT_PREFERRED_REACTION_EMOJI } from './constants';
import * as emoji from '../components/emoji/lib';

const PREFERRED_REACTION_EMOJI_COUNT = DEFAULT_PREFERRED_REACTION_EMOJI.length;

export function getPreferredReactionEmoji(storedValue: unknown): Array<string> {
  const isStoredValueValid =
    Array.isArray(storedValue) &&
    storedValue.length === PREFERRED_REACTION_EMOJI_COUNT &&
    storedValue.every(emoji.isShortName) &&
    !hasDuplicates(storedValue);
  return isStoredValueValid ? storedValue : DEFAULT_PREFERRED_REACTION_EMOJI;
}

function hasDuplicates(arr: ReadonlyArray<unknown>): boolean {
  return new Set(arr).size !== arr.length;
}

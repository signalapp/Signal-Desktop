// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as grapheme from './grapheme';
import { getEmojiCount } from '../components/emoji/lib';

export function isEmojiOnlyText(text: string): boolean {
  return grapheme.count(text) === getEmojiCount(text);
}

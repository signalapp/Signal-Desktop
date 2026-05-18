// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { DataReader } from '../sql/Client.preload.ts';
import type { Emoji } from '../axo/emoji.std.ts';
import type { EmojisStateType } from '../state/ducks/emojis.preload.ts';

let recentEmojis: ReadonlyArray<Emoji.Parent>;

export async function loadRecentEmojis(): Promise<void> {
  recentEmojis = await DataReader.getRecentEmojis(32);
}

export function getRecentEmojisForRedux(): EmojisStateType {
  return { recentEmojis };
}

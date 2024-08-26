// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { take } from 'lodash';
import { DataReader } from '../sql/Client';

export type RecentEmojiObjectType = {
  recents: Array<string>;
};

let initialState: RecentEmojiObjectType;

async function getRecentEmojisForRedux() {
  const recent = await DataReader.getRecentEmojis();
  return recent.map(e => e.shortName);
}

export async function loadRecentEmojis(): Promise<void> {
  const recents = await getRecentEmojisForRedux();

  initialState = {
    recents: take(recents, 32),
  };
}

export function getEmojiReducerState(): RecentEmojiObjectType {
  return initialState;
}

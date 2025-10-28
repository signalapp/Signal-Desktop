// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { DataReader } from '../sql/Client.preload.js';
import type { GifsStateType } from '../state/ducks/gifs.preload.js';
import { MAX_RECENT_GIFS } from '../state/ducks/gifs.preload.js';
import { strictAssert } from '../util/assert.std.js';

let state: GifsStateType;

export async function loadGifsState(): Promise<void> {
  const recentGifs = await DataReader.getRecentGifs(MAX_RECENT_GIFS);
  state = { recentGifs };
}

export function getGifsStateForRedux(): GifsStateType {
  strictAssert(
    state != null,
    'getGifsStateForRedux: state has not been loaded'
  );
  return state;
}

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DurationInSeconds } from './durations/index.js';
import type { ItemsStateType } from '../state/ducks/items.js';
import { itemStorage } from '../textsecure/Storage.js';

export const ITEM_NAME = 'universalExpireTimer';

export function get(): DurationInSeconds {
  return DurationInSeconds.fromSeconds(itemStorage.get(ITEM_NAME) || 0);
}
export function getForRedux(items: ItemsStateType): DurationInSeconds {
  return DurationInSeconds.fromSeconds(items[ITEM_NAME] || 0);
}

export function set(newValue: DurationInSeconds | undefined): Promise<void> {
  return itemStorage.put(ITEM_NAME, newValue || DurationInSeconds.ZERO);
}

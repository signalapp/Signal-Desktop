// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DurationInSeconds } from './durations';

export const ITEM_NAME = 'universalExpireTimer';

export function get(): DurationInSeconds {
  return DurationInSeconds.fromSeconds(window.storage.get(ITEM_NAME) || 0);
}

export function set(newValue: DurationInSeconds | undefined): Promise<void> {
  return window.storage.put(ITEM_NAME, newValue || DurationInSeconds.ZERO);
}

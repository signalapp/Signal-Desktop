// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { size } from './iterables';

export function count(str: string): number {
  const segments = new Intl.Segmenter().segment(str);
  return size(segments);
}

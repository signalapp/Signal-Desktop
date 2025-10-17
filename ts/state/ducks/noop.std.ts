// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

export type NoopActionType = ReadonlyDeep<{
  type: 'NOOP';
  payload: null;
}>;

export function noopAction(): NoopActionType {
  return {
    type: 'NOOP',
    payload: null,
  };
}

// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

export type NoopActionType = ReadonlyDeep<{
  type: `NOOP/${string}`;
  payload: null;
}>;

export function noopAction(cause: string): NoopActionType {
  return {
    type: `NOOP/${cause}`,
    payload: null,
  };
}

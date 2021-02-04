// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type NoopActionType = {
  type: 'NOOP';
  payload: null;
};

export function noopAction(): NoopActionType {
  return {
    type: 'NOOP',
    payload: null,
  };
}

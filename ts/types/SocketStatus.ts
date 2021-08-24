// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Maps to values found here: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
// which are returned by libtextsecure's MessageReceiver
export enum SocketStatus {
  CONNECTING = 'CONNECTING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

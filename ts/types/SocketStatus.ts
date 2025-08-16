// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { TransportOption } from '../textsecure/WebsocketResources';

// Maps to values found here: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
// which are returned by libtextsecure's MessageReceiver
export enum SocketStatus {
  CONNECTING = 'CONNECTING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export type SocketInfo = {
  status: SocketStatus;
  lastConnectionTimestamp?: number;
  lastConnectionTransport?:
    | TransportOption.Libsignal
    | TransportOption.Original;
};

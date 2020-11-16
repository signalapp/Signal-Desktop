// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { w3cwebsocket } from 'websocket';

type ModifiedEventSource = Omit<EventSource, 'onerror'>;

declare class ModifiedWebSocket extends w3cwebsocket
  implements ModifiedEventSource {
  withCredentials: boolean;

  addEventListener: EventSource['addEventListener'];

  removeEventListener: EventSource['removeEventListener'];

  dispatchEvent: EventSource['dispatchEvent'];
}

export type WebSocket = ModifiedWebSocket;
export const WebSocket = w3cwebsocket as typeof ModifiedWebSocket;

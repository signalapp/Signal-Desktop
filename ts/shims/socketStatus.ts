// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SocketStatus } from '../types/SocketStatus';

export function getSocketStatus(): SocketStatus {
  const { getSocketStatus: getMessageReceiverStatus } = window;

  return getMessageReceiverStatus();
}

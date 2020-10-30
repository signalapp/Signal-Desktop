// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function getSocketStatus(): number {
  const { getSocketStatus: getMessageReceiverStatus } = window;

  return getMessageReceiverStatus();
}

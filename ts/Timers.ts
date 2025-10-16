// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { timers } = window.SignalContext;

export type { Timeout } from './context/Timers.node.js';

export function setTimeout(
  ...args: Parameters<typeof timers.setTimeout>
): ReturnType<typeof timers.setTimeout> {
  return timers.setTimeout(...args);
}

export function clearTimeout(
  ...args: Parameters<typeof timers.clearTimeout>
): ReturnType<typeof timers.clearTimeout> {
  return timers.clearTimeout(...args);
}

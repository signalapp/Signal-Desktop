// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Matching Whisper.events.trigger API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function trigger(name: string, ...rest: Array<any>): void {
  window.Whisper.events.trigger(name, ...rest);
}

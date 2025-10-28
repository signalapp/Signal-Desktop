// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Use this function when asynchronous action has to run without blocking its
// parent.
export function drop(promise: Promise<unknown> | undefined): void {
  void promise;
}

// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export class SafeStorageBackendChangeError extends Error {
  override name = 'SafeStorageBackendChangeError';

  public readonly currentBackend: string;
  public readonly previousBackend: string;

  constructor({
    currentBackend,
    previousBackend,
  }: {
    currentBackend: string;
    previousBackend: string;
  }) {
    super(
      `Detected change in safeStorage backend, can't decrypt DB key (previous: ${previousBackend}, current: ${currentBackend})`
    );

    this.currentBackend = currentBackend;
    this.previousBackend = previousBackend;
  }
}

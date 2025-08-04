// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type ZoneOptions = {
  readonly pendingKyberPreKeysToRemove?: boolean;
  readonly pendingPreKeysToRemove?: boolean;
  readonly pendingSenderKeys?: boolean;
  readonly pendingSessions?: boolean;
  readonly pendingUnprocessed?: boolean;
};

export class Zone {
  constructor(
    public readonly name: string,
    private readonly options: ZoneOptions = {}
  ) {}

  public supportsPendingKyberPreKeysToRemove(): boolean {
    return this.options.pendingKyberPreKeysToRemove === true;
  }

  public supportsPendingPreKeysToRemove(): boolean {
    return this.options.pendingPreKeysToRemove === true;
  }

  public supportsPendingSenderKeys(): boolean {
    return this.options.pendingSenderKeys === true;
  }

  public supportsPendingSessions(): boolean {
    return this.options.pendingSessions === true;
  }

  public supportsPendingUnprocessed(): boolean {
    return this.options.pendingUnprocessed === true;
  }
}

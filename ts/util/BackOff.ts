// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export class BackOff {
  private count = 0;

  constructor(private readonly timeouts: ReadonlyArray<number>) {}

  public get(): number {
    return this.timeouts[this.count];
  }

  public getAndIncrement(): number {
    const result = this.get();
    if (!this.isFull()) {
      this.count += 1;
    }

    return result;
  }

  public reset(): void {
    this.count = 0;
  }

  public isFull(): boolean {
    return this.count === this.timeouts.length - 1;
  }

  public getIndex(): number {
    return this.count;
  }
}

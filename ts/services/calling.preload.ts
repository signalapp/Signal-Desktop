// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Calling service removed - stub only

export class CallingClass {
  public async initialize(..._args: Array<unknown>): Promise<void> {
    // Stub implementation
  }

  public hangupAllCalls(..._args: Array<unknown>): void {
    // Stub implementation
  }

  public hangUpActiveCall(..._args: Array<unknown>): void {
    // Stub implementation
  }

  public async readCallLink(..._args: Array<unknown>): Promise<unknown> {
    return null;
  }
}

export const calling = new CallingClass();

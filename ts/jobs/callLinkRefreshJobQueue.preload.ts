// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: callLinkRefreshJobQueue removed - stub only

export class CallLinkRefreshJobQueue {
  streamJobs(): Promise<void> {
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

export const callLinkRefreshJobQueue = new CallLinkRefreshJobQueue();

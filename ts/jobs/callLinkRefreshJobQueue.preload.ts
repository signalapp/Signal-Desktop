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

  updatePendingCallLinkStorageFields(_roomId: string, _fields: unknown): void {
    // No-op
  }

  getPendingAdminCallLinks(): unknown[] {
    return [];
  }

  hasPendingCallLink(_roomId: string): boolean {
    return false;
  }

  add(_job: unknown): Promise<void> {
    return Promise.resolve();
  }
}

export const callLinkRefreshJobQueue = new CallLinkRefreshJobQueue();

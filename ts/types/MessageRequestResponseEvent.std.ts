// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
export enum MessageRequestResponseEvent {
  ACCEPT = 'ACCEPT',
  BLOCK = 'BLOCK',
  UNBLOCK = 'UNBLOCK',
  SPAM = 'SPAM',
}

export enum MessageRequestResponseSource {
  LOCAL = 'LOCAL',
  MRR_SYNC = 'MRR_SYNC',
  BLOCK_SYNC = 'BLOCK_SYNC',
  STORAGE_SERVICE = 'STORAGE_SERVICE',
}

export type MessageRequestResponseInfo =
  | {
      source: MessageRequestResponseSource.LOCAL;
      timestamp: number;
    }
  | {
      source: MessageRequestResponseSource.STORAGE_SERVICE;
      learnedAtMs: number;
    }
  | {
      source:
        | MessageRequestResponseSource.BLOCK_SYNC
        | MessageRequestResponseSource.MRR_SYNC;
      timestamp: number;
      receivedAtMs: number;
      receivedAtCounter: number;
    };

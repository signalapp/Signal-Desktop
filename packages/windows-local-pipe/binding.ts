// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadBinding from 'bindings';

export type PendingPipe = { readonly __pendingPipe: never };

export type NativeEvent =
  | ['listening', undefined]
  | ['connection', { pipe: PendingPipe; clientProcessId: number }]
  | ['data', Buffer<ArrayBuffer>]
  | ['end', undefined]
  | ['writeDone', { id: number; code: number }]
  | ['error', Error & { code: number }]
  | ['closed', undefined];

export type OnEvent = (...event: NativeEvent) => void;

export type NativeServer = { close(): void };
export type NativeConnection = {
  // Stream chunks may live in Node's shared buffer pool.
  // oxlint-disable-next-line typescript/no-unnecessary-type-arguments
  write(data: Buffer<ArrayBufferLike>, id: number): void;
  setReading(reading: boolean): void;
  close(): void;
};

export type BindingType = Readonly<{
  PipeServer: new (name: string, onEvent: OnEvent) => NativeServer;
  PipeConnection: new (pipe: PendingPipe, onEvent: OnEvent) => NativeConnection;
}>;

let binding: BindingType | undefined;
if (process.platform === 'win32') {
  binding = loadBinding('windows-local-pipe');
}

export function getBinding(): BindingType {
  if (!binding) {
    throw new Error('This library works only on Windows');
  }
  return binding;
}

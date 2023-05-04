// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import * as log from '../logging/log';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';
import { explodePromise } from '../util/explodePromise';

const SQL_CHANNEL_KEY = 'sql-channel';
let activeJobCount = 0;
let resolveShutdown: (() => void) | undefined;
let shutdownPromise: Promise<void> | null = null;

export async function ipcInvoke(
  name: string,
  args: ReadonlyArray<unknown>
): Promise<void> {
  const fnName = String(name);

  if (shutdownPromise && name !== 'close') {
    throw new Error(
      `Rejecting SQL channel job (${fnName}); application is shutting down`
    );
  }

  activeJobCount += 1;
  return createTaskWithTimeout(async () => {
    try {
      return await ipcRenderer.invoke(SQL_CHANNEL_KEY, name, ...args);
    } finally {
      activeJobCount -= 1;
      if (activeJobCount === 0) {
        resolveShutdown?.();
      }
    }
  }, `SQL channel call (${fnName})`)();
}

export async function doShutdown(): Promise<void> {
  log.info(
    `data.shutdown: shutdown requested. ${activeJobCount} jobs outstanding`
  );

  if (shutdownPromise) {
    return shutdownPromise;
  }

  // No outstanding jobs, return immediately
  if (activeJobCount === 0) {
    return;
  }

  ({ promise: shutdownPromise, resolve: resolveShutdown } =
    explodePromise<void>());

  try {
    await shutdownPromise;
  } finally {
    log.info('data.shutdown: process complete');
  }
}

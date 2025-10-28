// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import { createLogger } from '../logging/log.std.js';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';

const log = createLogger('channels');

const SQL_READ_KEY = 'sql-channel:read';
const SQL_WRITE_KEY = 'sql-channel:write';
const SQL_REMOVE_DB_KEY = 'sql-channel:remove-db';
let activeJobCount = 0;
let resolveShutdown: (() => void) | undefined;
let shutdownPromise: Promise<void> | null = null;

export enum AccessType {
  Read = 'Read',
  Write = 'Write',
}

export async function ipcInvoke<T>(
  access: AccessType,
  name: string,
  args: ReadonlyArray<unknown>
): Promise<T> {
  const fnName = String(name);

  if (shutdownPromise && name !== 'close') {
    throw new Error(
      `Rejecting SQL channel job (${access}, ${fnName}); ` +
        'application is shutting down'
    );
  }

  let channel: string;
  if (access === AccessType.Read) {
    channel = SQL_READ_KEY;
  } else if (access === AccessType.Write) {
    channel = SQL_WRITE_KEY;
  } else {
    throw missingCaseError(access);
  }

  activeJobCount += 1;
  return createTaskWithTimeout(async () => {
    try {
      const result = await ipcRenderer.invoke(channel, name, ...args);
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    } finally {
      activeJobCount -= 1;
      if (activeJobCount === 0) {
        resolveShutdown?.();
      }
    }
  }, `SQL channel call (${access}, ${fnName})`)();
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

export async function removeDB(): Promise<void> {
  return ipcRenderer.invoke(SQL_REMOVE_DB_KEY);
}

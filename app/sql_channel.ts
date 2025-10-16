// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain } from 'electron';

import type { MainSQL } from '../ts/sql/main.main.js';
import { remove as removeUserConfig } from './user_config.main.js';
import { remove as removeEphemeralConfig } from './ephemeral_config.main.js';

let sql:
  | Pick<
      MainSQL,
      | 'sqlRead'
      | 'sqlWrite'
      | 'pauseWriteAccess'
      | 'resumeWriteAccess'
      | 'removeDB'
    >
  | undefined;

let initialized = false;

const SQL_READ_KEY = 'sql-channel:read';
const SQL_WRITE_KEY = 'sql-channel:write';
const SQL_REMOVE_DB_KEY = 'sql-channel:remove-db';
const ERASE_SQL_KEY = 'erase-sql-key';
const PAUSE_WRITE_ACCESS = 'pause-sql-writes';
const RESUME_WRITE_ACCESS = 'resume-sql-writes';

function wrapResult<Params extends Array<unknown>, T>(
  fn: (...params: Params) => Promise<T>
): (
  ...params: Params
) => Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  return async function wrappedIpcSqlMethod(...params) {
    try {
      return {
        ok: true,
        value: await fn(...params),
      };
    } catch (error) {
      return {
        ok: false,
        error,
      };
    }
  };
}

export function initialize(mainSQL: typeof sql): void {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }
  initialized = true;

  sql = mainSQL;

  ipcMain.handle(
    SQL_READ_KEY,
    wrapResult(function ipcSqlReadHandler(_event, callName, ...args) {
      if (!sql) {
        throw new Error(`${SQL_READ_KEY}: Not yet initialized!`);
      }
      return sql.sqlRead(callName, ...args);
    })
  );

  ipcMain.handle(
    SQL_WRITE_KEY,
    wrapResult(function ipcSqlWriteHandler(_event, callName, ...args) {
      if (!sql) {
        throw new Error(`${SQL_WRITE_KEY}: Not yet initialized!`);
      }
      return sql.sqlWrite(callName, ...args);
    })
  );

  ipcMain.handle(SQL_REMOVE_DB_KEY, () => {
    if (!sql) {
      throw new Error(`${SQL_REMOVE_DB_KEY}: Not yet initialized!`);
    }
    return sql.removeDB();
  });

  ipcMain.handle(ERASE_SQL_KEY, () => {
    removeUserConfig();
    removeEphemeralConfig();
  });

  ipcMain.handle(PAUSE_WRITE_ACCESS, () => {
    if (!sql) {
      throw new Error(`${PAUSE_WRITE_ACCESS}: Not yet initialized!`);
    }
    return sql.pauseWriteAccess();
  });

  ipcMain.handle(RESUME_WRITE_ACCESS, () => {
    if (!sql) {
      throw new Error(`${PAUSE_WRITE_ACCESS}: Not yet initialized!`);
    }
    return sql.resumeWriteAccess();
  });
}

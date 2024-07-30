// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain } from 'electron';

import type { MainSQL } from '../ts/sql/main';
import { remove as removeUserConfig } from './user_config';
import { remove as removeEphemeralConfig } from './ephemeral_config';

let sql:
  | Pick<
      MainSQL,
      'sqlRead' | 'sqlWrite' | 'pauseWriteAccess' | 'resumeWriteAccess'
    >
  | undefined;

let initialized = false;

const SQL_READ_KEY = 'sql-channel:read';
const SQL_WRITE_KEY = 'sql-channel:write';
const ERASE_SQL_KEY = 'erase-sql-key';
const PAUSE_WRITE_ACCESS = 'pause-sql-writes';
const RESUME_WRITE_ACCESS = 'resume-sql-writes';

export function initialize(mainSQL: typeof sql): void {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }
  initialized = true;

  sql = mainSQL;

  ipcMain.handle(SQL_READ_KEY, (_event, callName, ...args) => {
    if (!sql) {
      throw new Error(`${SQL_READ_KEY}: Not yet initialized!`);
    }
    return sql.sqlRead(callName, ...args);
  });

  ipcMain.handle(SQL_WRITE_KEY, (_event, callName, ...args) => {
    if (!sql) {
      throw new Error(`${SQL_WRITE_KEY}: Not yet initialized!`);
    }
    return sql.sqlWrite(callName, ...args);
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

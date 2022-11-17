// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain } from 'electron';

import type { MainSQL } from '../ts/sql/main';
import { remove as removeUserConfig } from './user_config';
import { remove as removeEphemeralConfig } from './ephemeral_config';

let sql: Pick<MainSQL, 'sqlCall'> | undefined;

let initialized = false;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';

export function initialize(mainSQL: Pick<MainSQL, 'sqlCall'>): void {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }
  initialized = true;

  sql = mainSQL;

  ipcMain.handle(SQL_CHANNEL_KEY, (_event, callName, ...args) => {
    if (!sql) {
      throw new Error(`${SQL_CHANNEL_KEY}: Not yet initialized!`);
    }
    return sql.sqlCall(callName, ...args);
  });

  ipcMain.handle(ERASE_SQL_KEY, () => {
    removeUserConfig();
    removeEphemeralConfig();
  });
}

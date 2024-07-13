// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { deleteAllLogs } from '../util/deleteAllLogs';
import * as Errors from '../types/errors';

export async function deleteAllData(): Promise<void> {
  try {
    await deleteAllLogs();

    log.info('deleteAllData: deleted all logs');

    await window.Signal.Data.removeAll();

    log.info('deleteAllData: emptied database');

    await window.Signal.Data.close();

    log.info('deleteAllData: closed database');

    await window.Signal.Data.removeDB();

    log.info('deleteAllData: removed database');

    await window.Signal.Data.removeOtherData();

    log.info('deleteAllData: removed all other data');
  } catch (error) {
    log.error(
      'Something went wrong deleting all data:',
      Errors.toLogFormat(error)
    );
  }
  window.SignalContext.restartApp();
}

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import { deleteAllLogs } from '../util/deleteAllLogs';
import * as Errors from '../types/errors';

export async function deleteAllData(): Promise<void> {
  try {
    await deleteAllLogs();

    log.info('deleteAllData: deleted all logs');

    await DataWriter.removeAll();

    log.info('deleteAllData: emptied database');

    await DataWriter.close();

    log.info('deleteAllData: closed database');

    await DataWriter.removeDB();

    log.info('deleteAllData: removed database');

    await DataWriter.removeOtherData();

    log.info('deleteAllData: removed all other data');
  } catch (error) {
    log.error(
      'Something went wrong deleting all data:',
      Errors.toLogFormat(error)
    );
  }
  window.SignalContext.restartApp();
}

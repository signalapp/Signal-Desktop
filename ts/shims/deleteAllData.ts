// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import { deleteAllLogs } from '../util/deleteAllLogs';
import * as Errors from '../types/errors';

export async function deleteAllData(): Promise<void> {
  try {
    // This might fail if websocket closes before we receive the response, while
    // still unlinking the device on the server.
    await window.textsecure.server?.unlink();
  } catch (error) {
    log.error(
      'Something went wrong unlinking device:',
      Errors.toLogFormat(error)
    );
  }

  try {
    await deleteAllLogs();

    log.info('deleteAllData: deleted all logs');

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

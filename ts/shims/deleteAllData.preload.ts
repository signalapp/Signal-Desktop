// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { DataWriter } from '../sql/Client.preload.js';
import { deleteAllLogs } from '../util/deleteAllLogs.preload.js';
import * as Errors from '../types/errors.std.js';
import { unlink } from '../textsecure/WebAPI.preload.js';

const log = createLogger('deleteAllData');

export async function deleteAllData(): Promise<void> {
  try {
    // This might fail if websocket closes before we receive the response, while
    // still unlinking the device on the server.
    await unlink();
  } catch (error) {
    log.error(
      'Something went wrong unlinking device:',
      Errors.toLogFormat(error)
    );
  }

  try {
    await deleteAllLogs();

    log.info('deleted all logs');

    await DataWriter.close();

    log.info('closed database');

    await DataWriter.removeDB();

    log.info('removed database');

    await DataWriter.removeOtherData();

    log.info('removed all other data');
  } catch (error) {
    log.error(
      'Something went wrong deleting all data:',
      Errors.toLogFormat(error)
    );
  }
  window.SignalContext.restartApp();
}

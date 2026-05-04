// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { deleteAllLogs } from '../util/deleteAllLogs.preload.ts';
import * as Errors from '../types/errors.std.ts';
import { unlink, deleteAccount } from '../textsecure/WebAPI.preload.ts';
import { leaveAllGroups } from '../util/leaveAllGroups.preload.ts';

const log = createLogger('deleteAllData');

export type StateType = 'leaving-groups' | 'deleting-account' | 'deleting-data';

export async function deleteAllData(
  callback: (state: StateType) => unknown
): Promise<void> {
  try {
    if (window.ConversationController.areWePrimaryDevice()) {
      callback('leaving-groups');
      log.info('leaving all groups');
      await leaveAllGroups();

      callback('deleting-account');
      log.info('deleting account');
      await deleteAccount();
    } else {
      callback('deleting-data');
      log.info('unlinking device');
      await unlink();
    }
  } catch (error) {
    // Sometimes the websocket closes before we receive the response, while
    // still removing things on the server.

    log.error(
      'Something went wrong; continuing with delete.',
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

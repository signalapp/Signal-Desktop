// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain as ipc } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

import {
  Notifier,
  sendDummyKeystroke,
} from '@indutny/simple-windows-notifications';

import * as log from '../ts/logging/log';
import { AUMID } from './startup_config';
import type { WindowsNotificationData } from '../ts/services/notifications';
import { renderWindowsToast } from './renderWindowsToast';

export { sendDummyKeystroke };

const notifier = new Notifier(AUMID);

const NOTIFICATION_ID = {
  group: 'group',
  tag: 'tag',
};

ipc.handle(
  'windows-notifications:show',
  (_event: IpcMainInvokeEvent, data: WindowsNotificationData) => {
    try {
      // First, clear all previous notifications - we want just one notification at a time
      notifier.remove(NOTIFICATION_ID);
      notifier.show(renderWindowsToast(data), NOTIFICATION_ID);
    } catch (error) {
      log.error(
        `Windows Notifications: Failed to show notification: ${error.stack}`
      );
    }
  }
);

ipc.handle('windows-notifications:clear-all', () => {
  try {
    notifier.remove(NOTIFICATION_ID);
  } catch (error) {
    log.error(
      `Windows Notifications: Failed to clear notifications: ${error.stack}`
    );
  }
});

// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain as ipc } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

import {
  Notifier,
  sendDummyKeystroke,
} from '@indutny/simple-windows-notifications';

import { createLogger } from '../ts/logging/log.std.js';
import { AUMID } from './startup_config.main.js';
import type { WindowsNotificationData } from '../ts/services/notifications.preload.js';
// eslint-disable-next-line local-rules/file-suffix
import { renderWindowsToast } from './renderWindowsToast.dom.js';

const log = createLogger('WindowsNotifications');

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

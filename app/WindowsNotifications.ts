// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcMain as ipc } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';

// These dependencies don't export typescript properly
//   https://github.com/NodeRT/NodeRT/issues/167

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { XmlDocument } from '@nodert-win10-rs4/windows.data.xml.dom';
import {
  ToastNotification,
  ToastNotificationManager,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
} from '@nodert-win10-rs4/windows.ui.notifications';

import * as log from '../ts/logging/log';
import { AUMID } from './startup_config';
import type { WindowsNotificationData } from '../ts/services/notifications';
import { renderWindowsToast } from './renderWindowsToast';

export { sendDummyKeystroke } from '@signalapp/windows-dummy-keystroke';

const NOTIFICATION_GROUP = 'group';
const NOTIFICATION_TAG = 'tag';

ipc.handle(
  'windows-notifications:show',
  (_event: IpcMainInvokeEvent, data: WindowsNotificationData) => {
    try {
      // First, clear all previous notifications - we want just one notification at a time
      clearAllNotifications();

      const xmlDocument = new XmlDocument();
      xmlDocument.loadXml(renderWindowsToast(data));

      const toast = new ToastNotification(xmlDocument);
      toast.tag = NOTIFICATION_TAG;
      toast.group = NOTIFICATION_GROUP;

      const notifier = ToastNotificationManager.createToastNotifier(AUMID);
      notifier.show(toast);
    } catch (error) {
      log.error(
        `Windows Notifications: Failed to show notification: ${error.stack}`
      );
    }
  }
);

ipc.handle('windows-notifications:clear-all', () => {
  try {
    clearAllNotifications();
  } catch (error) {
    log.error(
      `Windows Notifications: Failed to clear notifications: ${error.stack}`
    );
  }
});

function clearAllNotifications() {
  ToastNotificationManager.history.remove(
    NOTIFICATION_TAG,
    NOTIFICATION_GROUP,
    AUMID
  );
}

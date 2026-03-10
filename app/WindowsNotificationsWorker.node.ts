// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parentPort, workerData } from 'node:worker_threads';

import {
  Notifier,
  sendDummyKeystroke,
} from '@indutny/simple-windows-notifications';

import { createLogger } from '../ts/logging/log.std.js';
import {
  WindowsNotificationWorkerDataSchema,
  WindowsNotificationRequestSchema,
} from '../ts/types/notifications.std.js';
import OS from '../ts/util/os/osMain.node.js';
import { missingCaseError } from '../ts/util/missingCaseError.std.js';
import { renderWindowsToast } from './renderWindowsToast.std.js';

if (!parentPort) {
  throw new Error('Must run as a worker thread');
}

if (!OS.isWindows()) {
  throw new Error('Runs only on Windows');
}

const port = parentPort;

const log = createLogger('WindowsNotificationsWorker');

const { AUMID } = WindowsNotificationWorkerDataSchema.parse(workerData);
const notifier = new Notifier(AUMID);

const NOTIFICATION_ID = {
  group: 'group',
  tag: 'tag',
};

port.on('message', (message: unknown) => {
  const request = WindowsNotificationRequestSchema.parse(message);

  if (request.command === 'show') {
    try {
      // First, clear all previous notifications - we want just one
      // notification at a time
      notifier.remove(NOTIFICATION_ID);
      notifier.show(
        renderWindowsToast(request.notificationData),
        NOTIFICATION_ID
      );
    } catch (error) {
      log.error(
        `Windows Notifications: Failed to show notification: ${error.stack}`
      );
    }
    return;
  }

  if (request.command === 'clearAll') {
    try {
      notifier.remove(NOTIFICATION_ID);
    } catch (error) {
      log.error(
        `Windows Notifications: Failed to clear notifications: ${error.stack}`
      );
    }
    return;
  }

  if (request.command === 'sendDummyKeystroke') {
    try {
      sendDummyKeystroke();
    } catch (error) {
      log.error(
        `Windows Notifications: Failed to send dummy keystroke: ${error.stack}`
      );
    }
    return;
  }

  throw missingCaseError(request);
});
